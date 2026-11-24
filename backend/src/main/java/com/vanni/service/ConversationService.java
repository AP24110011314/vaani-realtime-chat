package com.vanni.service;

import com.vanni.dto.request.AddMembersRequest;
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

    public ConversationService(
            ConversationRepository conversationRepository,
            ConversationMemberRepository conversationMemberRepository,
            UserRepository userRepository,
            MessageRepository messageRepository,
            ConversationAccessService conversationAccessService,
            UserService userService,
            MessageService messageService,
            EventPublisher eventPublisher) {
        this.conversationRepository = conversationRepository;
        this.conversationMemberRepository = conversationMemberRepository;
        this.userRepository = userRepository;
        this.messageRepository = messageRepository;
        this.conversationAccessService = conversationAccessService;
        this.userService = userService;
        this.messageService = messageService;
        this.eventPublisher = eventPublisher;
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
            .map(m -> userService.toUserSummary(m.getUser(), m.getRole()))
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
