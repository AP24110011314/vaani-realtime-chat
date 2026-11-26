package com.vanni;

import com.vanni.dto.response.CatchUpSummaryDto;
import com.vanni.entity.Attachment;
import com.vanni.entity.Message;
import com.vanni.entity.MessageType;
import com.vanni.entity.User;
import com.vanni.util.AiSummaryParser;
import com.vanni.util.TranscriptBuilder;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

public class CatchUpUnitTest {

    private final ObjectMapper objectMapper = JsonMapper.builder().build();

    @Test
    void parserHandlesCodeFencesDropsUnknownIdsAndCapsLists() {
        String raw = """
            Sure, here is the JSON summary:
            ```json
            {
              "overview": "Team finalized release checklist and QA status.",
              "keyPoints": [
                {"text": "Point 1", "messageIds": [101, 999999]},
                {"text": "Point 2", "messageIds": ["102"]},
                {"text": "Point 3", "messageIds": []},
                {"text": "Point 4", "messageIds": [101]},
                {"text": "Point 5", "messageIds": [101]},
                {"text": "Point 6", "messageIds": [101]},
                {"text": "Point 7", "messageIds": [101]},
                {"text": "Point 8", "messageIds": [101]},
                {"text": "Point 9 overflow", "messageIds": [101]}
              ],
              "actionItems": [
                {"who": "Ravi", "what": "Fix bug", "messageIds": [102, 888]}
              ]
            }
            ```
            """;

        CatchUpSummaryDto dto = AiSummaryParser.parseAndSanitize(raw, Set.of(101L, 102L), objectMapper);
        assertThat(dto.overview()).contains("release checklist");
        assertThat(dto.keyPoints()).hasSize(8);
        assertThat(dto.keyPoints().get(0).messageIds()).containsExactly(101L);
        assertThat(dto.keyPoints().get(1).messageIds()).containsExactly(102L);
        assertThat(dto.decisions()).isEmpty();
        assertThat(dto.forYou()).isEmpty();
        assertThat(dto.actionItems()).hasSize(1);
        assertThat(dto.actionItems().get(0).messageIds()).containsExactly(102L);
    }

    @Test
    void parserRejectsMalformedJson() {
        assertThatThrownBy(() -> AiSummaryParser.parseAndSanitize("not json at all", Set.of(1L), objectMapper))
            .isInstanceOf(AiSummaryParser.InvalidSummaryResponseException.class);
        assertThatThrownBy(() -> AiSummaryParser.parseAndSanitize("{\"keyPoints\":[]}", Set.of(1L), objectMapper))
            .isInstanceOf(AiSummaryParser.InvalidSummaryResponseException.class);
    }

    @Test
    void transcriptBuilderExcludesDeletedResolvesMentionsAndCapsSize() {
        User asha = User.builder().id(1L).name("Asha").build();
        User ravi = User.builder().id(2L).name("Ravi").build();

        Message deleted = Message.builder()
            .id(10L).sender(ravi).content("SECRET DELETED TEXT")
            .messageType(MessageType.TEXT).deletedAt(Instant.now()).createdAt(Instant.now()).build();
        Message sys = Message.builder()
            .id(11L).sender(ravi).content("Ravi joined")
            .messageType(MessageType.SYSTEM).createdAt(Instant.now()).build();
        Message oldMsg = Message.builder()
            .id(12L).sender(ravi).content("Very old long context ".repeat(40))
            .messageType(MessageType.TEXT).createdAt(Instant.now()).build();
        Message newMsg = Message.builder()
            .id(13L).sender(ravi).content("Hey <@1>, check the spec")
            .messageType(MessageType.TEXT).createdAt(Instant.now()).build();
        Message fileMsg = Message.builder()
            .id(14L).sender(asha).content(null)
            .messageType(MessageType.FILE).createdAt(Instant.now()).build();

        Attachment att = Attachment.builder().id(5L).fileName("design-v2.pdf").build();
        Map<Long, List<Attachment>> attMap = Map.of(14L, List.of(att));
        Map<Long, String> names = Map.of(1L, "Asha", 2L, "Ravi");

        TranscriptBuilder.BuildResult result = TranscriptBuilder.build(
            List.of(deleted, sys, oldMsg, newMsg, fileMsg),
            1L,
            names,
            attMap,
            600,
            false
        );

        assertThat(result.transcript()).doesNotContain("SECRET DELETED TEXT");
        assertThat(result.transcript()).doesNotContain("Ravi joined");
        assertThat(result.transcript()).doesNotContain("Very old long context");
        assertThat(result.transcript()).contains("[#13]");
        assertThat(result.transcript()).contains("@You");
        assertThat(result.transcript()).contains("You: [file: design-v2.pdf]");
        assertThat(result.truncated()).isTrue();
        assertThat(result.includedMessageIds()).containsExactlyInAnyOrder(13L, 14L);
    }
}
