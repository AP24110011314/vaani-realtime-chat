package com.vanni.repository;

import com.vanni.entity.User;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);

    @Query("""
        SELECT u FROM User u
        WHERE u.id != :currentUserId
          AND u.enabled = true
          AND (LOWER(u.name) LIKE :pattern OR LOWER(u.email) LIKE :pattern)
        ORDER BY u.name ASC
    """)
    List<User> searchUsers(@Param("currentUserId") Long currentUserId, @Param("pattern") String pattern, Pageable pageable);
}
