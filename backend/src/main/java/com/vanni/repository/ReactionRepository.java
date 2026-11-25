package com.vanni.repository;

import com.vanni.entity.Reaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReactionRepository extends JpaRepository<Reaction, Long> {

    List<Reaction> findByMessageId(Long messageId);

    @Query("SELECT r FROM Reaction r WHERE r.message.id IN :messageIds")
    List<Reaction> findByMessageIds(@Param("messageIds") List<Long> messageIds);

    Optional<Reaction> findByMessageIdAndUserIdAndEmoji(Long messageId, Long userId, String emoji);
}
