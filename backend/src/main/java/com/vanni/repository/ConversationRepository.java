package com.vanni.repository;

import com.vanni.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    Optional<Conversation> findByDirectKey(String directKey);

    @Query("""
        SELECT cm.conversation FROM ConversationMember cm
        WHERE cm.user.id = :userId
          AND cm.leftAt IS NULL
          AND cm.archived = :archived
        ORDER BY cm.pinned DESC,
                 CASE WHEN cm.conversation.lastMessageAt IS NULL THEN 1 ELSE 0 END ASC,
                 cm.conversation.lastMessageAt DESC,
                 cm.conversation.updatedAt DESC
    """)
    List<Conversation> findUserConversations(@Param("userId") Long userId, @Param("archived") boolean archived);
}
