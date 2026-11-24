package com.vanni.service;

import com.vanni.dto.response.ConversationDto;
import com.vanni.dto.response.MessageDto;
import com.vanni.dto.response.UserSummaryResponse;
import com.vanni.entity.Conversation;
import com.vanni.entity.ConversationMember;
import com.vanni.entity.ConversationType;
import com.vanni.entity.MemberRole;
import com.vanni.entity.User;
import com.vanni.exception.ApiException;
import com.vanni.repository.ConversationMemberRepository;
import com.vanni.repository.ConversationRepository;
import com.vanni.repository.MessageRepository;
import com.vanni.repository.UserRepository;
import com.vanni.util.DirectKey;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final ConversationAccessService conversationAccessService;
    private final UserService userService;
    private final MessageService messageService;

    public ConversationService(
            ConversationRepository conversationRepository,
            ConversationMemberRepository conversationMemberRepository,
            UserRepository userRepository,
            MessageRepository messageRepository,
            ConversationAccessService conversationAccessService,
            UserService userService,
            MessageService messageService) {
        this.conversationRepository = conversationRepository;
        this.conversationMemberRepository = conversationMemberRepository;
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
        this.conversationAccessService = conversationAccessService;
        this.userService = userService;
        this.messageService = messageService;
    }

    public ConversationDto getOrCreateDirect(Long currentUserId, Long targetUserId) {
        if (currentUserId.equals(targetUserId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PARTICIPANT", "Cannot start a conversation with yourself");
        }

        User currentUser = userRepository.findById(currentUserId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Current user not found"));
        User targetUser = userRepository.findById(targetUserId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Target user not found"));

        String directKey = DirectKey.of(currentUserId, targetUserId);

        Optional<Conversation> existing = conversationRepository.findByDirectKey(directKey);
        if (existing.isPresent()) {
            return toDto(existing.get(), currentUserId);
        }

        try {
            Conversation conv = new Conversation();
            conv.setType(ConversationType.DIRECT);
            conv.setDirectKey(directKey);
            conv.setCreatedBy(currentUser);
            conv = conversationRepository.saveAndFlush(conv);

            ConversationMember cm1 = new ConversationMember(conv, currentUser, MemberRole.MEMBER);
            ConversationMember cm2 = new ConversationMember(conv, targetUser, MemberRole.MEMBER);
            conversationMemberRepository.save(cm1);
            conversationMemberRepository.save(cm2);

            return toDto(conv, currentUserId);
        } catch (DataIntegrityViolationException ex) {
            Conversation conv = conversationRepository.findByDirectKey(directKey)
                .orElseThrow(() -> ex);
            return toDto(conv, currentUserId);
        }
    }

    @Transactional(readOnly = true)
    public List<ConversationDto> getConversations(Long userId, boolean archived) {
        List<Conversation> convs = conversationRepository.findUserConversations(userId, archived);
        return convs.stream()
            .map(c -> toDto(c, userId))
            .toList();
    }

    @Transactional(readOnly = true)
    public ConversationDto getConversation(Long conversationId, Long userId) {
        ConversationMember member = conversationAccessService.requireMember(conversationId, userId);
        return toDto(member.getConversation(), userId);
    }

    public ConversationDto toDto(Conversation conv, Long currentUserId) {
        List<ConversationMember> members = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(conv.getId());

        ConversationMember myMember = members.stream()
            .filter(m -> m.getUser().getId().equals(currentUserId))
            .findFirst()
            .orElse(null);

        String title;
        String avatarUrl;
        String description;

        if (conv.getType() == ConversationType.DIRECT) {
            User peer = members.stream()
                .map(ConversationMember::getUser)
                .filter(u -> !u.getId().equals(currentUserId))
                .findFirst()
                .orElse(myMember != null ? myMember.getUser() : null);

            title = peer != null ? peer.getName() : "Direct Chat";
            avatarUrl = peer != null ? peer.getAvatarUrl() : null;
            description = peer != null ? peer.getAbout() : null;
        } else {
            title = conv.getTitle();
            avatarUrl = conv.getAvatarUrl();
            description = conv.getDescription();
        }

        MemberRole myRole = myMember != null ? myMember.getRole() : MemberRole.MEMBER;
        boolean muted = myMember != null && myMember.isMuted();
        boolean archived = myMember != null && myMember.isArchived();
        boolean pinned = myMember != null && myMember.isPinned();

        Long lastReadId = myMember != null ? myMember.getLastReadMessageId() : null;
        long unreadCount = messageRepository.countUnread(conv.getId(), lastReadId, currentUserId);

        MessageDto lastMessage = conv.getLastMessage() != null ? messageService.toDto(conv.getLastMessage()) : null;

        List<UserSummaryResponse> memberSummaries = members.stream()
            .map(m -> userService.toUserSummary(m.getUser()))
            .toList();

        return new ConversationDto(
            conv.getId(),
            conv.getType(),
            title,
            avatarUrl,
            description,
            memberSummaries,
            myRole,
            muted,
            archived,
            pinned,
            unreadCount,
            lastMessage,
            conv.getLastMessageAt() != null ? conv.getLastMessageAt() : conv.getUpdatedAt()
        );
    }
}
