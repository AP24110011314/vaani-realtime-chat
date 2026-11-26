package com.vanni.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "call_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CallLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "call_uuid", nullable = false, unique = true, length = 64)
    private String callUuid;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conversation_id", nullable = false)
    private Conversation conversation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "caller_id", nullable = false)
    private User caller;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "callee_id", nullable = false)
    private User callee;

    @Enumerated(EnumType.STRING)
    @Column(name = "call_type", nullable = false, columnDefinition = "ENUM('AUDIO', 'VIDEO')")
    private CallType callType;

    @Enumerated(EnumType.STRING)
    @Column(name = "end_reason", nullable = false, columnDefinition = "ENUM('COMPLETED', 'DECLINED', 'CANCELLED', 'MISSED', 'BUSY', 'FAILED', 'DISCONNECTED', 'HANDLED_ELSEWHERE')")
    private CallEndReason endReason;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "connected_at")
    private Instant connectedAt;

    @Column(name = "ended_at", nullable = false)
    private Instant endedAt;

    @Column(name = "duration_sec", nullable = false)
    @Builder.Default
    private Integer durationSec = 0;
}
