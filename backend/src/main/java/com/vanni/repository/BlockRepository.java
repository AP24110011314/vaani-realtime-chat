package com.vanni.repository;

import com.vanni.entity.Block;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BlockRepository extends JpaRepository<Block, Long> {

    Optional<Block> findByBlockerIdAndBlockedId(Long blockerId, Long blockedId);

    boolean existsByBlockerIdAndBlockedId(Long blockerId, Long blockedId);

    @Query("SELECT CASE WHEN COUNT(b) > 0 THEN TRUE ELSE FALSE END FROM Block b " +
           "WHERE (b.blocker.id = :u1 AND b.blocked.id = :u2) " +
           "   OR (b.blocker.id = :u2 AND b.blocked.id = :u1)")
    boolean isBlockedEitherWay(@Param("u1") Long u1, @Param("u2") Long u2);

    @Query("SELECT b.blocked.id FROM Block b WHERE b.blocker.id = :userId")
    List<Long> findBlockedUserIds(@Param("userId") Long userId);

    @Query("SELECT b.blocker.id FROM Block b WHERE b.blocked.id = :userId")
    List<Long> findBlockerUserIds(@Param("userId") Long userId);

    @Query("SELECT b FROM Block b JOIN FETCH b.blocked WHERE b.blocker.id = :userId ORDER BY b.createdAt DESC")
    List<Block> findByBlockerIdWithUser(@Param("userId") Long userId);
}
