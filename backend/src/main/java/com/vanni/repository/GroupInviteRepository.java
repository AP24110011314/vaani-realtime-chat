package com.vanni.repository;

import com.vanni.entity.GroupInvite;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface GroupInviteRepository extends JpaRepository<GroupInvite, Long> {

    Optional<GroupInvite> findByCodeHash(String codeHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT gi FROM GroupInvite gi JOIN FETCH gi.conversation WHERE gi.codeHash = :codeHash")
    Optional<GroupInvite> findByCodeHashForUpdate(@Param("codeHash") String codeHash);

    @Query("SELECT gi FROM GroupInvite gi JOIN FETCH gi.createdBy WHERE gi.conversation.id = :convId ORDER BY gi.createdAt DESC")
    List<GroupInvite> findByConversationIdOrderByCreatedAtDesc(@Param("convId") Long convId);

    @Query("""
        SELECT COUNT(gi) FROM GroupInvite gi
        WHERE gi.conversation.id = :convId
          AND gi.revokedAt IS NULL
          AND (gi.expiresAt IS NULL OR gi.expiresAt > :now)
          AND (gi.maxUses IS NULL OR gi.useCount < gi.maxUses)
    """)
    long countActiveByConversationId(@Param("convId") Long convId, @Param("now") Instant now);

    Optional<GroupInvite> findByIdAndConversationId(Long id, Long conversationId);

    @Modifying
    @Query("DELETE FROM GroupInvite gi WHERE gi.expiresAt IS NOT NULL AND gi.expiresAt < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") Instant cutoff);
}
