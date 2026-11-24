package com.vanni.repository;

import com.vanni.entity.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends JpaRepository<Message, Long> {

    Optional<Message> findBySenderIdAndClientMessageId(Long senderId, String clientMessageId);

    Optional<Message> findByIdAndConversationId(Long id, Long conversationId);

    @Query("SELECT m FROM Message m WHERE m.conversation.id = :convId AND m.id < :before ORDER BY m.id DESC")
    List<Message> findBefore(@Param("convId") Long convId, @Param("before") Long before, Pageable pageable);

    @Query("SELECT m FROM Message m WHERE m.conversation.id = :convId ORDER BY m.id DESC")
    List<Message> findLatest(@Param("convId") Long convId, Pageable pageable);

    @Query("SELECT m FROM Message m WHERE m.conversation.id = :convId AND m.id > :after ORDER BY m.id ASC")
    List<Message> findAfter(@Param("convId") Long convId, @Param("after") Long after, Pageable pageable);

    Optional<Message> findTopByConversationIdOrderByIdDesc(Long conversationId);

    @Query("""
        SELECT m FROM Message m
        WHERE m.conversation.id = :convId
          AND m.id <= :upToId
          AND m.sender.id != :senderId
          AND m.deletedAt IS NULL
        ORDER BY m.id ASC
    """)
    List<Message> findUpToMessage(
        @Param("convId") Long convId,
        @Param("upToId") Long upToId,
        @Param("senderId") Long senderId
    );

    @Query("""
        SELECT m FROM Message m
        WHERE m.conversation.id = :convId
          AND m.sender.id != :userId
          AND m.deletedAt IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM MessageReceipt r
              WHERE r.message.id = m.id AND r.user.id = :userId
          )
    """)
    List<Message> findMessagesWithoutReceiptFromUser(
        @Param("convId") Long convId,
        @Param("userId") Long userId
    );

    @Query("""
        SELECT COUNT(m) FROM Message m
        WHERE m.conversation.id = :convId
          AND (:lastReadId IS NULL OR m.id > :lastReadId)
          AND m.sender.id != :userId
          AND m.deletedAt IS NULL
    """)
    long countUnread(@Param("convId") Long convId, @Param("lastReadId") Long lastReadId, @Param("userId") Long userId);
}
