package com.vanni.repository;

import com.vanni.entity.CallLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CallLogRepository extends JpaRepository<CallLog, Long> {

    List<CallLog> findTop20ByConversationIdOrderByEndedAtDesc(Long conversationId);
}
