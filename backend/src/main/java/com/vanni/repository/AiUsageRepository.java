package com.vanni.repository;

import com.vanni.entity.AiUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface AiUsageRepository extends JpaRepository<AiUsage, Long> {

    long countByUserIdAndStatusInAndCreatedAtAfter(Long userId, List<String> statuses, Instant after);
}
