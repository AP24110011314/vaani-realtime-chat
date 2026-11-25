package com.vanni.repository;

import com.vanni.entity.MessageMention;
import com.vanni.entity.MessageMentionId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageMentionRepository extends JpaRepository<MessageMention, MessageMentionId> {

    @Query("SELECT mm FROM MessageMention mm JOIN FETCH mm.user WHERE mm.id.messageId = :messageId")
    List<MessageMention> findByMessageIdWithUser(@Param("messageId") Long messageId);

    @Query("SELECT mm FROM MessageMention mm JOIN FETCH mm.user WHERE mm.id.messageId IN :messageIds")
    List<MessageMention> findByMessageIdsWithUser(@Param("messageIds") List<Long> messageIds);

    @Modifying
    @Query("DELETE FROM MessageMention mm WHERE mm.id.messageId = :messageId")
    void deleteByMessageId(@Param("messageId") Long messageId);
}
