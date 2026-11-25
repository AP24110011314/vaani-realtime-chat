package com.vanni.repository;

import com.vanni.entity.ScheduledMessage;
import com.vanni.entity.ScheduledMessageStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface ScheduledMessageRepository extends JpaRepository<ScheduledMessage, Long> {

    long countBySenderIdAndStatus(Long senderId, ScheduledMessageStatus status);

    Optional<ScheduledMessage> findBySenderIdAndClientMessageId(Long senderId, String clientMessageId);

    Optional<ScheduledMessage> findByIdAndSenderId(Long id, Long senderId);

    @Query("SELECT s FROM ScheduledMessage s JOIN FETCH s.conversation c WHERE s.sender.id = :senderId AND (:status IS NULL OR s.status = :status) AND (:conversationId IS NULL OR c.id = :conversationId) ORDER BY s.scheduledFor ASC, s.id ASC")
    List<ScheduledMessage> findForSender(
        @Param("senderId") Long senderId,
        @Param("status") ScheduledMessageStatus status,
        @Param("conversationId") Long conversationId
    );

    @Query(value = """
        SELECT id FROM scheduled_messages
        WHERE status = 'PENDING' AND scheduled_for <= :now
        ORDER BY scheduled_for ASC, id ASC
        LIMIT :batchSize
        FOR UPDATE SKIP LOCKED
        """, nativeQuery = true)
    List<Long> findDueIdsForUpdateSkipLocked(@Param("now") Instant now, @Param("batchSize") int batchSize);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE ScheduledMessage s SET s.status = :toStatus, s.updatedAt = :now WHERE s.id IN :ids AND s.status = :fromStatus")
    int transitionBatchStatus(
        @Param("ids") List<Long> ids,
        @Param("fromStatus") ScheduledMessageStatus fromStatus,
        @Param("toStatus") ScheduledMessageStatus toStatus,
        @Param("now") Instant now
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE ScheduledMessage s SET s.status = com.vanni.entity.ScheduledMessageStatus.SENDING, s.updatedAt = :now WHERE s.id = :id AND s.status = com.vanni.entity.ScheduledMessageStatus.PENDING")
    int claimSinglePending(@Param("id") Long id, @Param("now") Instant now);
}
