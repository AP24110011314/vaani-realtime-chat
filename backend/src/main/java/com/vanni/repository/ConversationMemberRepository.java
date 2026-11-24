package com.vanni.repository;

import com.vanni.entity.ConversationMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationMemberRepository extends JpaRepository<ConversationMember, Long> {
    Optional<ConversationMember> findByConversationIdAndUserIdAndLeftAtIsNull(Long conversationId, Long userId);

    List<ConversationMember> findByConversationIdAndLeftAtIsNull(Long conversationId);

    boolean existsByConversationIdAndUserIdAndLeftAtIsNull(Long conversationId, Long userId);
}
