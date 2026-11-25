package com.vanni.repository;

import com.vanni.entity.MessageReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface MessageReceiptRepository extends JpaRepository<MessageReceipt, Long> {

    Optional<MessageReceipt> findByMessageIdAndUserId(Long messageId, Long userId);

    List<MessageReceipt> findByMessageId(Long messageId);

    @Modifying
    @Query(value = """
        INSERT IGNORE INTO message_receipts (message_id, user_id, status, updated_at)
        VALUES (:messageId, :userId, :status, :updatedAt)
    """, nativeQuery = true)
    int insertIgnoreReceipt(
        @Param("messageId") Long messageId,
        @Param("userId") Long userId,
        @Param("status") String status,
        @Param("updatedAt") Instant updatedAt
    );

    @Modifying
    @Query("""
        UPDATE MessageReceipt r
        SET r.status = com.vanni.entity.ReceiptStatus.READ, r.updatedAt = :updatedAt
        WHERE r.message.id = :messageId AND r.user.id = :userId AND r.status <> com.vanni.entity.ReceiptStatus.READ
    """)
    int upgradeToRead(
        @Param("messageId") Long messageId,
        @Param("userId") Long userId,
        @Param("updatedAt") Instant updatedAt
    );

    @Query("SELECT r FROM MessageReceipt r WHERE r.message.id IN :messageIds")
    List<MessageReceipt> findByMessageIds(@Param("messageIds") List<Long> messageIds);

    @Query("SELECT r FROM MessageReceipt r WHERE r.user.id = :userId AND r.message.id IN :messageIds")
    List<MessageReceipt> findByUserIdAndMessageIds(@Param("userId") Long userId, @Param("messageIds") List<Long> messageIds);

    @Query("""
        SELECT r FROM MessageReceipt r
        JOIN FETCH r.user u
        WHERE r.message.id = :messageId
    """)
    List<MessageReceipt> findWithUserByMessageId(@Param("messageId") Long messageId);
}
