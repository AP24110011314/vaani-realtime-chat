package com.vanni.unit;

import com.vanni.dto.response.PresenceDto;
import com.vanni.entity.*;
import com.vanni.exception.ApiException;
import com.vanni.repository.*;
import com.vanni.service.*;
import com.vanni.util.DirectKey;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ServiceUnitTest {

    @Mock
    private ConversationMemberRepository memberRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private EventPublisher eventPublisher;
    @Mock
    private BlockRepository blockRepository;

    @Test
    void directKey_isSymmetric() {
        assertThat(DirectKey.of(5L, 12L)).isEqualTo(DirectKey.of(12L, 5L));
        assertThat(DirectKey.of(5L, 12L)).isEqualTo("5_12");
    }

    @Test
    void conversationAccessService_enforcesMembershipAndAdminRules() {
        ConversationAccessService accessService = new ConversationAccessService(memberRepository);

        User u = User.builder().id(1L).name("Alice").email("a@vanni.app").passwordHash("h").build();
        Conversation directConv = Conversation.builder().id(10L).type(ConversationType.DIRECT).createdBy(u).build();
        Conversation groupConv = Conversation.builder().id(20L).type(ConversationType.GROUP).title("Team").createdBy(u).build();

        ConversationMember directMember = new ConversationMember(directConv, u, MemberRole.MEMBER);
        ConversationMember groupMember = new ConversationMember(groupConv, u, MemberRole.MEMBER);
        ConversationMember groupAdmin = new ConversationMember(groupConv, u, MemberRole.ADMIN);

        when(memberRepository.findByConversationIdAndUserIdAndLeftAtIsNull(10L, 1L)).thenReturn(Optional.of(directMember));
        when(memberRepository.findByConversationIdAndUserIdAndLeftAtIsNull(20L, 1L)).thenReturn(Optional.of(groupMember));
        when(memberRepository.findByConversationIdAndUserIdAndLeftAtIsNull(99L, 1L)).thenReturn(Optional.empty());

        // Non-member receives 404 (not 403, avoiding existence leak)
        assertThatThrownBy(() -> accessService.requireMember(99L, 1L))
            .isInstanceOf(ApiException.class)
            .extracting(e -> ((ApiException) e).getStatus())
            .isEqualTo(HttpStatus.NOT_FOUND);

        // Direct chat member lacks ADMIN role -> 403
        assertThatThrownBy(() -> accessService.requireAdmin(10L, 1L))
            .isInstanceOf(ApiException.class)
            .extracting(e -> ((ApiException) e).getStatus())
            .isEqualTo(HttpStatus.FORBIDDEN);

        // Group regular member gets 403 for admin action
        assertThatThrownBy(() -> accessService.requireAdmin(20L, 1L))
            .isInstanceOf(ApiException.class)
            .extracting(e -> ((ApiException) e).getStatus())
            .isEqualTo(HttpStatus.FORBIDDEN);

        // Group admin passes
        when(memberRepository.findByConversationIdAndUserIdAndLeftAtIsNull(20L, 1L)).thenReturn(Optional.of(groupAdmin));
        assertThat(accessService.requireAdmin(20L, 1L)).isSameAs(groupAdmin);
    }

    @Test
    void presenceService_masksBlockedUsersAndPrivacyUsers() {
        PresenceService presenceService = new PresenceService(userRepository, memberRepository, eventPublisher, blockRepository);

        User blocker = User.builder().id(1L).name("Blocker").showLastSeen(true).lastSeenAt(Instant.now()).build();
        User blocked = User.builder().id(2L).name("Blocked").showLastSeen(true).lastSeenAt(Instant.now()).build();
        User hidden = User.builder().id(3L).name("Hidden").showLastSeen(false).lastSeenAt(Instant.now()).build();

        when(userRepository.findAllById(List.of(1L, 2L, 3L))).thenReturn(List.of(blocker, blocked, hidden));
        when(blockRepository.isBlockedEitherWay(2L, 1L)).thenReturn(true);
        when(blockRepository.isBlockedEitherWay(2L, 3L)).thenReturn(false);

        presenceService.onSessionConnected("s1", 1L);
        presenceService.onSessionConnected("s3", 3L);

        List<PresenceDto> dtos = presenceService.getPresence(List.of(1L, 2L, 3L), 2L);
        assertThat(dtos).hasSize(3);

        // Blocker's presence masked from blocked user
        PresenceDto blockerDto = dtos.stream().filter(p -> p.userId().equals(1L)).findFirst().orElseThrow();
        assertThat(blockerDto.online()).isFalse();
        assertThat(blockerDto.lastSeenAt()).isNull();

        // Hidden user's online & lastSeen masked
        PresenceDto hiddenDto = dtos.stream().filter(p -> p.userId().equals(3L)).findFirst().orElseThrow();
        assertThat(hiddenDto.online()).isFalse();
        assertThat(hiddenDto.lastSeenAt()).isNull();
    }
}
