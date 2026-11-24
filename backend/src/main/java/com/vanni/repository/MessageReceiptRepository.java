package com.vanni.repository;

import com.vanni.entity.MessageReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageReceiptRepository extends JpaRepository<MessageReceipt, Long> {

    Optional<MessageReceipt> findByMessageIdAndUserId(Long messageId, Long userId);

    List<MessageReceipt> findByMessageId(Long messageId);

    @Query("SELECT r FROM MessageReceipt r WHERE r.message.id IN :messageIds")
    List<MessageReceipt> findByMessageIds(@Param("messageIds") List<Long> messageIds);

    @Query("""
        SELECT r FROM MessageReceipt r
        JOIN FETCH r.user u
        WHERE r.message.id = :messageId
    """)
    List<MessageReceipt> findWithUserByMessageId(@Param("messageId") Long messageId);
}
