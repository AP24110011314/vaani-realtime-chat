package com.vanni.repository;

import com.vanni.entity.MessageLinkPreview;
import com.vanni.entity.MessageLinkPreviewId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface MessageLinkPreviewRepository extends JpaRepository<MessageLinkPreview, MessageLinkPreviewId> {

    @Query("""
        SELECT mlp FROM MessageLinkPreview mlp
        JOIN FETCH mlp.preview
        WHERE mlp.message.id = :messageId
        ORDER BY mlp.position ASC
    """)
    List<MessageLinkPreview> findByMessageIdWithPreview(@Param("messageId") Long messageId);

    @Query("""
        SELECT mlp FROM MessageLinkPreview mlp
        JOIN FETCH mlp.preview
        WHERE mlp.message.id IN :messageIds
        ORDER BY mlp.position ASC
    """)
    List<MessageLinkPreview> findByMessageIdsWithPreview(@Param("messageIds") Collection<Long> messageIds);

    @Modifying
    @Query("DELETE FROM MessageLinkPreview mlp WHERE mlp.message.id = :messageId")
    void deleteByMessageId(@Param("messageId") Long messageId);
}
