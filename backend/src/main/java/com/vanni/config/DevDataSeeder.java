package com.vanni.config;

import com.vanni.entity.*;
import com.vanni.repository.*;
import com.vanni.service.ConversationService;
import com.vanni.service.MessageService;
import com.vanni.dto.request.SendMessageRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Profile("dev")
public class DevDataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DevDataSeeder.class);

    private final UserRepository userRepository;
    private final ConversationService conversationService;
    private final MessageService messageService;
    private final PasswordEncoder passwordEncoder;

    public DevDataSeeder(
            UserRepository userRepository,
            ConversationService conversationService,
            MessageService messageService,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.conversationService = conversationService;
        this.messageService = messageService;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (userRepository.count() >= 5) {
            log.info("Dev seed data already exists ({} users found). Skipping.", userRepository.count());
            return;
        }

        log.info("Seeding development users and sample messages...");
        String encodedPassword = passwordEncoder.encode("Password@123");

        User asha = createUser("Asha Sharma", "asha@example.com", encodedPassword, "Hey there! I am using Vanni.");
        User ravi = createUser("Ravi Patel", "ravi@example.com", encodedPassword, "Available");
        User priya = createUser("Priya Singh", "priya@example.com", encodedPassword, "At work");
        User arjun = createUser("Arjun Kumar", "arjun@example.com", encodedPassword, "Coffee & Code");
        User neha = createUser("Neha Verma", "neha@example.com", encodedPassword, "Busy");

        userRepository.saveAll(List.of(asha, ravi, priya, arjun, neha));

        // Create sample direct conversation between Asha and Ravi
        var convDto = conversationService.getOrCreateDirect(asha.getId(), ravi.getId());
        messageService.send(convDto.id(), asha.getId(), new SendMessageRequest("Hi Ravi! How is the project going?", "seed-msg-1", null));
        messageService.send(convDto.id(), ravi.getId(), new SendMessageRequest("Hey Asha! Going great, wrapping up Phase 3 now.", "seed-msg-2", null));

        log.info("Dev seed data successfully seeded.");
    }

    private User createUser(String name, String email, String passwordHash, String about) {
        return userRepository.findByEmail(email).orElseGet(() -> {
            User u = new User();
            u.setName(name);
            u.setEmail(email);
            u.setPasswordHash(passwordHash);
            u.setAbout(about);
            u.setEnabled(true);
            u.setShowLastSeen(true);
            u.setShowReadReceipts(true);
            return u;
        });
    }
}
