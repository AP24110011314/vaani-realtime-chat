package com.vanni.service;

import com.vanni.entity.ConversationMember;
import com.vanni.entity.MemberRole;
import com.vanni.exception.ApiException;
import com.vanni.repository.ConversationMemberRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ConversationAccessService {

    private final ConversationMemberRepository conversationMemberRepository;

    public ConversationAccessService(ConversationMemberRepository conversationMemberRepository) {
        this.conversationMemberRepository = conversationMemberRepository;
    }

    public ConversationMember requireMember(Long conversationId, Long userId) {
        return conversationMemberRepository
            .findByConversationIdAndUserIdAndLeftAtIsNull(conversationId, userId)
            .orElseThrow(() -> new ApiException(
                HttpStatus.NOT_FOUND,
                "NOT_FOUND",
                "Conversation not found or you are not a member"
            ));
    }

    public ConversationMember requireAdmin(Long conversationId, Long userId) {
        ConversationMember member = requireMember(conversationId, userId);
        if (member.getRole() != MemberRole.ADMIN) {
            throw new ApiException(
                HttpStatus.FORBIDDEN,
                "FORBIDDEN",
                "Admin privileges required for this conversation"
            );
        }
        return member;
    }
}
