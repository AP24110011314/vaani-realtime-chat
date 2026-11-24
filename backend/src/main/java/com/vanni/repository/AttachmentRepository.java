package com.vanni.repository;

import com.vanni.entity.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    List<Attachment> findByMessageId(Long messageId);

    @Query("SELECT a FROM Attachment a WHERE a.message.id IN :messageIds")
    List<Attachment> findByMessageIds(@Param("messageIds") List<Long> messageIds);

    Optional<Attachment> findByIdAndUploaderId(Long id, Long uploaderId);

    List<Attachment> findByMessageIsNullAndCreatedAtBefore(Instant cutoff);
}
