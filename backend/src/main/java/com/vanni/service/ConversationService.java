package com.vanni.service;

import com.vanni.dto.request.AddMembersRequest;
import com.vanni.dto.request.ConversationSettingsRequest;
import com.vanni.dto.request.CreateGroupRequest;
import com.vanni.dto.request.SetRoleRequest;
import com.vanni.dto.request.UpdateGroupRequest;
import com.vanni.dto.response.ConversationDto;
import com.vanni.dto.response.MessageDto;
import com.vanni.dto.response.UserSummaryResponse;
import com.vanni.entity.Conversation;
import com.vanni.entity.ConversationMember;
import com.vanni.entity.ConversationType;
import com.vanni.entity.MemberRole;
import com.vanni.entity.Message;
import com.vanni.entity.MessageType;
import com.vanni.entity.NotifyMode;
import com.vanni.entity.User;
import com.vanni.exception.ApiException;
import com.vanni.repository.BlockRepository;
import com.vanni.repository.ConversationMemberRepository;
import com.vanni.repository.ConversationRepository;
import com.vanni.repository.MessageRepository;
import com.vanni.repository.UserRepository;
import com.vanni.storage.StorageService;
import com.vanni.util.DirectKey;
import com.vanni.util.MimeSniffer;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

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
    private final EventPublisher eventPublisher;
    private final BlockRepository blockRepository;
    private final StorageService storageService;

    public ConversationService(
            ConversationRepository conversationRepository,
            ConversationMemberRepository conversationMemberRepository,
            UserRepository userRepository,
            MessageRepository messageRepository,
            ConversationAccessService conversationAccessService,
            UserService userService,
            MessageService messageService,
            EventPublisher eventPublisher,
            BlockRepository blockRepository,
            StorageService storageService) {
        this.conversationRepository = conversationRepository;
        this.conversationMemberRepository = conversationMemberRepository;
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
        this.conversationAccessService = conversationAccessService;
        this.userService = userService;
        this.messageService = messageService;
        this.eventPublisher = eventPublisher;
        this.blockRepository = blockRepository;
        this.storageService = storageService;
    }

    public ConversationDto getOrCreateDirect(Long currentUserId, Long targetUserId) {
        if (currentUserId.equals(targetUserId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PARTICIPANT", "Cannot start a conversation with yourself");
        }

        if (blockRepository.isBlockedEitherWay(currentUserId, targetUserId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "USER_BLOCKED", "Cannot create a conversation with a blocked user");
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

            ConversationDto dto = toDto(conv, currentUserId);
            ConversationDto targetDto = toDto(conv, targetUserId);
            eventPublisher.sendToUser(targetUserId, "conversation.created", targetDto);

            return dto;
        } catch (DataIntegrityViolationException ex) {
            Conversation conv = conversationRepository.findByDirectKey(directKey)
                .orElseThrow(() -> ex);
            return toDto(conv, currentUserId);
        }
    }

    public ConversationDto createGroup(Long creatorId, CreateGroupRequest req) {
        if (req.title() == null || req.title().trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Group title cannot be blank");
        }
        String trimmedTitle = req.title().trim();
        if (trimmedTitle.length() > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Group title cannot exceed 100 characters");
        }

        String trimmedDescription = req.description() != null ? req.description().trim() : null;
        if (trimmedDescription != null && trimmedDescription.length() > 500) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Group description cannot exceed 500 characters");
        }

        User creator = userRepository.findById(creatorId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "Creator not found"));

        if (req.memberIds() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Member IDs cannot be null");
        }

        Set<Long> uniqueMemberIds = new LinkedHashSet<>(req.memberIds());
        uniqueMemberIds.remove(creatorId);

        if (uniqueMemberIds.size() < 2) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "A group must have at least 2 other members");
        }

        if (uniqueMemberIds.size() + 1 > 256) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Group cannot exceed 256 members");
        }

        List<User> otherUsers = userRepository.findAllById(uniqueMemberIds);
        if (otherUsers.size() != uniqueMemberIds.size()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "One or more members were not found");
        }

        Conversation conv = new Conversation();
        conv.setType(ConversationType.GROUP);
        conv.setTitle(trimmedTitle);
        conv.setDescription(trimmedDescription);
        conv.setCreatedBy(creator);
        conv = conversationRepository.saveAndFlush(conv);

        ConversationMember creatorMember = new ConversationMember(conv, creator, MemberRole.ADMIN);
        conversationMemberRepository.save(creatorMember);

        for (User user : otherUsers) {
            ConversationMember member = new ConversationMember(conv, user, MemberRole.MEMBER);
            conversationMemberRepository.save(member);
        }

        // Create initial system message: "Creator created group 'Title'"
        createAndBroadcastSystemMessage(conv, creator, creator.getName() + " created group \"" + conv.getTitle() + "\"");

        // Broadcast conversation.created to all members
        List<ConversationMember> allMembers = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(conv.getId());
        for (ConversationMember cm : allMembers) {
            ConversationDto memberDto = toDto(conv, cm.getUser().getId());
            eventPublisher.sendToUser(cm.getUser().getId(), "conversation.created", memberDto);
        }

        return toDto(conv, creatorId);
    }

    public ConversationDto updateGroup(Long conversationId, Long userId, UpdateGroupRequest req) {
        ConversationMember member = conversationAccessService.requireMember(conversationId, userId);
        if (member.getRole() != MemberRole.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only group admins can update group details");
        }

        Conversation conv = member.getConversation();
        if (conv.getType() != ConversationType.GROUP) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_OPERATION", "Cannot update group details on direct conversation");
        }

        boolean changed = false;
        if (req.title() != null && !req.title().trim().isEmpty()) {
            String newTitle = req.title().trim();
            if (newTitle.length() > 100) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Group title cannot exceed 100 characters");
            }
            if (!newTitle.equals(conv.getTitle())) {
                conv.setTitle(newTitle);
                changed = true;
                createAndBroadcastSystemMessage(conv, member.getUser(), member.getUser().getName() + " changed the group name to \"" + newTitle + "\"");
            }
        }

        if (req.description() != null) {
            String newDesc = req.description().trim().isEmpty() ? null : req.description().trim();
            if (newDesc != null && newDesc.length() > 500) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Group description cannot exceed 500 characters");
            }
            conv.setDescription(newDesc);
            changed = true;
        }

        if (changed) {
            conv.setUpdatedAt(Instant.now());
            conversationRepository.save(conv);
            broadcastConversationUpdated(conv);
        }

        return toDto(conv, userId);
    }

    public ConversationDto addMembers(Long conversationId, Long adminId, AddMembersRequest req) {
        ConversationMember adminMember = conversationAccessService.requireMember(conversationId, adminId);
        if (adminMember.getRole() != MemberRole.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only group admins can add members");
        }

        Conversation conv = adminMember.getConversation();
        if (conv.getType() != ConversationType.GROUP) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_OPERATION", "Cannot add members to direct conversation");
        }

        if (req.userIds() == null || req.userIds().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "User IDs cannot be empty");
        }

        Set<Long> toAddIds = new LinkedHashSet<>(req.userIds());
        long currentCount = conversationMemberRepository.countByConversationIdAndLeftAtIsNull(conversationId);

        List<User> newlyAddedUsers = new ArrayList<>();
        for (Long uid : toAddIds) {
            if (uid.equals(adminId)) continue;

            Optional<ConversationMember> existingOpt = conversationMemberRepository.findByConversationIdAndUserId(conversationId, uid);
            if (existingOpt.isPresent()) {
                ConversationMember existing = existingOpt.get();
                if (existing.getLeftAt() == null) {
                    continue; // Already active member
                }
                existing.setLeftAt(null);
                existing.setRole(MemberRole.MEMBER);
                existing.setJoinedAt(Instant.now());
                conversationMemberRepository.save(existing);
                newlyAddedUsers.add(existing.getUser());
            } else {
                User u = userRepository.findById(uid)
                    .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User " + uid + " not found"));
                ConversationMember cm = new ConversationMember(conv, u, MemberRole.MEMBER);
                conversationMemberRepository.save(cm);
                newlyAddedUsers.add(u);
            }
        }

        if (currentCount + newlyAddedUsers.size() > 256) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Group cannot exceed 256 members");
        }

        if (!newlyAddedUsers.isEmpty()) {
            String names = newlyAddedUsers.stream().map(User::getName).collect(Collectors.joining(", "));
            createAndBroadcastSystemMessage(conv, adminMember.getUser(), adminMember.getUser().getName() + " added " + names);

            // Notify newly added users of conversation.created
            for (User u : newlyAddedUsers) {
                eventPublisher.sendToUser(u.getId(), "conversation.created", toDto(conv, u.getId()));
            }

            // Notify all active members of conversation.updated
            broadcastConversationUpdated(conv);
        }

        return toDto(conv, adminId);
    }

    public void removeMember(Long conversationId, Long adminId, Long targetUserId) {
        if (adminId.equals(targetUserId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_OPERATION", "Admins cannot remove themselves via removeMember; use leave instead");
        }

        ConversationMember adminMember = conversationAccessService.requireMember(conversationId, adminId);
        if (adminMember.getRole() != MemberRole.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only group admins can remove members");
        }

        Conversation conv = adminMember.getConversation();
        if (conv.getType() != ConversationType.GROUP) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_OPERATION", "Cannot remove members from direct conversation");
        }

        ConversationMember targetMember = conversationMemberRepository
            .findByConversationIdAndUserIdAndLeftAtIsNull(conversationId, targetUserId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "User is not an active member of this group"));

        targetMember.setLeftAt(Instant.now());
        conversationMemberRepository.save(targetMember);

        createAndBroadcastSystemMessage(conv, adminMember.getUser(), adminMember.getUser().getName() + " removed " + targetMember.getUser().getName());

        // Immediately notify target user of removal
        eventPublisher.sendToUser(targetUserId, "conversation.removed", Map.of("conversationId", conversationId));

        // Notify remaining active members
        broadcastConversationUpdated(conv);
    }

    public void leave(Long conversationId, Long userId) {
        ConversationMember member = conversationAccessService.requireMember(conversationId, userId);
        Conversation conv = member.getConversation();
        if (conv.getType() != ConversationType.GROUP) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_OPERATION", "Cannot leave a direct conversation");
        }

        member.setLeftAt(Instant.now());
        conversationMemberRepository.save(member);

        createAndBroadcastSystemMessage(conv, member.getUser(), member.getUser().getName() + " left the group");

        // Immediately notify leaving user of removal
        eventPublisher.sendToUser(userId, "conversation.removed", Map.of("conversationId", conversationId));

        // If the leaving user was ADMIN, verify remaining admins
        if (member.getRole() == MemberRole.ADMIN) {
            long remainingAdmins = conversationMemberRepository.countByConversationIdAndRoleAndLeftAtIsNull(conversationId, MemberRole.ADMIN);
            if (remainingAdmins == 0) {
                List<ConversationMember> remainingMembers =
                    conversationMemberRepository.findByConversationIdAndLeftAtIsNullOrderByJoinedAtAsc(conversationId);
                if (!remainingMembers.isEmpty()) {
                    ConversationMember oldest = remainingMembers.get(0);
                    oldest.setRole(MemberRole.ADMIN);
                    conversationMemberRepository.save(oldest);
                    createAndBroadcastSystemMessage(conv, member.getUser(), oldest.getUser().getName() + " is now an admin");
                }
            }
        }

        long remainingActiveCount = conversationMemberRepository.countByConversationIdAndLeftAtIsNull(conversationId);
        if (remainingActiveCount == 0) {
            // No one left, close/archive group
            conv.setUpdatedAt(Instant.now());
            conversationRepository.save(conv);
        } else {
            broadcastConversationUpdated(conv);
        }
    }

    public ConversationDto setRole(Long conversationId, Long adminId, Long targetUserId, MemberRole newRole) {
        ConversationMember adminMember = conversationAccessService.requireMember(conversationId, adminId);
        if (adminMember.getRole() != MemberRole.ADMIN) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only group admins can change roles");
        }

        Conversation conv = adminMember.getConversation();
        if (conv.getType() != ConversationType.GROUP) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_OPERATION", "Cannot set roles on direct conversation");
        }

        ConversationMember targetMember = conversationMemberRepository
            .findByConversationIdAndUserIdAndLeftAtIsNull(conversationId, targetUserId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "MEMBER_NOT_FOUND", "User is not an active member of this group"));

        if (targetMember.getRole() != newRole) {
            targetMember.setRole(newRole);
            conversationMemberRepository.save(targetMember);

            String roleStr = newRole == MemberRole.ADMIN ? "an admin" : "a member";
            createAndBroadcastSystemMessage(conv, adminMember.getUser(), adminMember.getUser().getName() + " changed " + targetMember.getUser().getName() + "'s role to " + roleStr);

            broadcastConversationUpdated(conv);
        }

        return toDto(conv, adminId);
    }

    private Message createAndBroadcastSystemMessage(Conversation conv, User actor, String content) {
        Message msg = new Message();
        msg.setConversation(conv);
        msg.setSender(actor);
        msg.setContent(content);
        msg.setMessageType(MessageType.SYSTEM);
        msg = messageRepository.save(msg);

        conv.setLastMessage(msg);
        conv.setLastMessageAt(msg.getCreatedAt());
        conv.setUpdatedAt(msg.getCreatedAt());
        conversationRepository.save(conv);

        MessageDto dto = messageService.toDto(msg);
        eventPublisher.sendToConversationMembers(conv.getId(), "message.created", dto);
        return msg;
    }

    public void broadcastConversationUpdated(Conversation conv) {
        List<ConversationMember> activeMembers = conversationMemberRepository.findByConversationIdAndLeftAtIsNull(conv.getId());
        for (ConversationMember m : activeMembers) {
            ConversationDto memberDto = toDto(conv, m.getUser().getId());
            eventPublisher.sendToUser(m.getUser().getId(), "conversation.updated", memberDto);
        }
    }

    public void broadcastUserConversationsUpdated(Long userId) {
        List<ConversationMember> activeMemberships = conversationMemberRepository.findByUserIdAndLeftAtIsNull(userId);
        for (ConversationMember cm : activeMemberships) {
            broadcastConversationUpdated(cm.getConversation());
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

    public ConversationDto updateSettings(Long conversationId, Long userId, ConversationSettingsRequest req) {
        ConversationMember member = conversationAccessService.requireMember(conversationId, userId);
        if (req != null) {
            if (req.notifyMode() != null) {
                member.setNotifyMode(req.notifyMode());
                member.setMuted(req.notifyMode() == NotifyMode.NONE);
            } else if (req.muted() != null) {
                member.setMuted(req.muted());
                member.setNotifyMode(req.muted() ? NotifyMode.NONE : NotifyMode.ALL);
            }
            if (req.archived() != null) {
                member.setArchived(req.archived());
            }
            if (req.pinned() != null) {
                member.setPinned(req.pinned());
            }
            conversationMemberRepository.save(member);
        }
        return toDto(member.getConversation(), userId);
    }

    @Transactional(readOnly = true)
    public List<UserSummaryResponse> getMentionableMembers(Long conversationId, Long currentUserId, String query) {
        ConversationMember member = conversationAccessService.requireMember(conversationId, currentUserId);
        if (member.getConversation().getType() != ConversationType.GROUP) {
            return List.of();
        }
        String trimmed = query == null ? "" : query.trim();
        if (trimmed.startsWith("@")) {
            trimmed = trimmed.substring(1).trim();
        }
        String prefix = trimmed.isEmpty() ? "" : trimmed.toLowerCase() + "%";
        return conversationMemberRepository
            .findMentionableMembers(conversationId, currentUserId, prefix, PageRequest.of(0, 8))
            .stream()
            .map(cm -> userService.toUserSummary(cm.getUser(), cm.getRole(), currentUserId))
            .toList();
    }

    public ConversationDto uploadGroupAvatar(Long conversationId, Long userId, MultipartFile file) {
        conversationAccessService.requireAdmin(conversationId, userId);
        Conversation conv = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CONVERSATION_NOT_FOUND", "Conversation not found"));

        if (conv.getType() != ConversationType.GROUP) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_OPERATION", "Avatars can only be uploaded for group conversations");
        }

        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_FILE", "Avatar file cannot be empty");
        }

        if (file.getSize() > 2L * 1024 * 1024) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE", "Avatar exceeds maximum size of 2MB");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR", "Failed to read avatar file");
        }

        MimeSniffer.SniffResult sniff = MimeSniffer.sniff(bytes, file.getOriginalFilename());
        String mime = sniff.mimeType();
        if (!"image/jpeg".equals(mime) && !"image/png".equals(mime) && !"image/webp".equals(mime)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "DISALLOWED_FILE_TYPE", "Only JPEG, PNG, and WebP images are permitted for avatars");
        }

        byte[] pngBytes;
        try {
            BufferedImage img = ImageIO.read(new ByteArrayInputStream(bytes));
            if (img == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_IMAGE", "Could not process image");
            }
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(img, "png", baos);
            pngBytes = baos.toByteArray();
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_IMAGE", "Failed to process image data");
        }

        String avatarKey = "avatar-group-" + conversationId + ".png";
        storageService.put(avatarKey, new ByteArrayInputStream(pngBytes), pngBytes.length, "image/png");

        conv.setAvatarUrl("/api/conversations/" + conversationId + "/avatar?v=" + System.currentTimeMillis());
        conv = conversationRepository.save(conv);

        broadcastConversationUpdated(conv);
        return toDto(conv, userId);
    }

    @Transactional(readOnly = true)
    public ResponseEntity<Resource> serveGroupAvatar(Long conversationId, Long userId) {
        conversationAccessService.requireMember(conversationId, userId);
        Conversation conv = conversationRepository.findById(conversationId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "CONVERSATION_NOT_FOUND", "Conversation not found"));

        if (conv.getAvatarUrl() == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "AVATAR_NOT_FOUND", "No avatar for this group");
        }

        InputStream is = storageService.get("avatar-group-" + conversationId + ".png");
        Resource resource = new InputStreamResource(is);

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"group-avatar.png\"")
            .header("X-Content-Type-Options", "nosniff")
            .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
            .contentType(MediaType.IMAGE_PNG)
            .body(resource);
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
        NotifyMode notifyMode = myMember != null && myMember.getNotifyMode() != null
            ? myMember.getNotifyMode()
            : (myMember != null && myMember.isMuted() ? NotifyMode.NONE : NotifyMode.ALL);
        boolean muted = notifyMode == NotifyMode.NONE;
        boolean archived = myMember != null && myMember.isArchived();
        boolean pinned = myMember != null && myMember.isPinned();

        Long lastReadId = myMember != null ? myMember.getLastReadMessageId() : null;
        long unreadCount = messageRepository.countUnread(conv.getId(), lastReadId, currentUserId);
        long mentionUnreadCount = conv.getType() == ConversationType.GROUP
            ? messageRepository.countUnreadMentions(conv.getId(), lastReadId, currentUserId)
            : 0L;

        MessageDto lastMessage = conv.getLastMessage() != null
            ? messageService.toDto(conv.getLastMessage(), currentUserId)
            : null;

        List<UserSummaryResponse> memberSummaries = members.stream()
            .map(m -> userService.toUserSummary(m.getUser(), m.getRole(), currentUserId))
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
            notifyMode,
            archived,
            pinned,
            unreadCount,
            mentionUnreadCount,
            lastMessage,
            conv.getLastMessageAt() != null ? conv.getLastMessageAt() : conv.getUpdatedAt()
        );
    }
}
