package com.vanni.repository;

import com.vanni.entity.LinkPreview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface LinkPreviewRepository extends JpaRepository<LinkPreview, Long> {
    Optional<LinkPreview> findByUrlHash(String urlHash);
    List<LinkPreview> findByExpiresAtBefore(Instant cutoff);
}
