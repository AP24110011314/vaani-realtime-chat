package com.vanni.repository;

import com.vanni.entity.GroupJoinRequest;
import com.vanni.entity.JoinRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface GroupJoinRequestRepository extends JpaRepository<GroupJoinRequest, Long> {

    @Query("SELECT r FROM GroupJoinRequest r JOIN FETCH r.user WHERE r.conversation.id = :convId AND r.status = :status ORDER BY r.createdAt ASC")
    List<GroupJoinRequest> findByConversationIdAndStatusWithUser(@Param("convId") Long convId, @Param("status") JoinRequestStatus status);

    Optional<GroupJoinRequest> findByConversationIdAndUserIdAndStatus(Long conversationId, Long userId, JoinRequestStatus status);

    Optional<GroupJoinRequest> findByIdAndConversationId(Long id, Long conversationId);

    @Modifying
    @Query("DELETE FROM GroupJoinRequest r WHERE r.conversation.id = :convId AND r.user.id = :userId AND r.status = :status")
    void deleteByConversationIdAndUserIdAndStatus(
        @Param("convId") Long convId,
        @Param("userId") Long userId,
        @Param("status") JoinRequestStatus status
    );

    @Modifying
    @Query("DELETE FROM GroupJoinRequest r WHERE r.status != 'PENDING' AND r.decidedAt IS NOT NULL AND r.decidedAt < :cutoff")
    int deleteDecidedOlderThan(@Param("cutoff") Instant cutoff);
}
