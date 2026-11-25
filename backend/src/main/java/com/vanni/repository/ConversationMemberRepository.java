package com.vanni.repository;

import com.vanni.entity.ConversationMember;
import com.vanni.entity.MemberRole;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationMemberRepository extends JpaRepository<ConversationMember, Long> {
    Optional<ConversationMember> findByConversationIdAndUserIdAndLeftAtIsNull(Long conversationId, Long userId);

    Optional<ConversationMember> findByConversationIdAndUserId(Long conversationId, Long userId);

    List<ConversationMember> findByConversationIdAndLeftAtIsNull(Long conversationId);

    List<ConversationMember> findByConversationIdAndLeftAtIsNullOrderByJoinedAtAsc(Long conversationId);

    List<ConversationMember> findByUserIdAndLeftAtIsNull(Long userId);

    boolean existsByConversationIdAndUserIdAndLeftAtIsNull(Long conversationId, Long userId);

    long countByConversationIdAndLeftAtIsNull(Long conversationId);

    long countByConversationIdAndRoleAndLeftAtIsNull(Long conversationId, MemberRole role);

    @Query("""
        SELECT cm FROM ConversationMember cm
        JOIN FETCH cm.user u
        WHERE cm.conversation.id = :convId
          AND cm.leftAt IS NULL
          AND u.id != :excludeUserId
          AND (:prefix = '' OR LOWER(u.name) LIKE :prefix)
        ORDER BY u.name ASC
    """)
    List<ConversationMember> findMentionableMembers(
        @Param("convId") Long convId,
        @Param("excludeUserId") Long excludeUserId,
        @Param("prefix") String prefix,
        Pageable pageable
    );
}
