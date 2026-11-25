package com.vanni.util;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.LongStream;

import static org.assertj.core.api.Assertions.assertThat;

class MentionParserTest {

    @Test
    void parse_extractsValidUniqueMemberIdsAndIgnoresInvalidOrNonMembers() {
        String content = "Hi <@2>, <@2>, <@999>, <@notanid>, and <@3>!";
        MentionParser.ParseResult res = MentionParser.parse(content, Set.of(1L, 2L, 3L), false);

        assertThat(res.userIds()).containsExactly(2L, 3L);
        assertThat(res.mentionsAll()).isFalse();
    }

    @Test
    void parse_enforcesMax20MentionsPerMessage() {
        Set<Long> members = LongStream.rangeClosed(1, 30).boxed().collect(Collectors.toSet());
        String content = LongStream.rangeClosed(1, 25)
            .mapToObj(id -> "<@" + id + ">")
            .collect(Collectors.joining(" "));

        MentionParser.ParseResult res = MentionParser.parse(content, members, false);

        assertThat(res.userIds()).hasSize(20);
        assertThat(res.userIds()).containsExactlyElementsOf(LongStream.rangeClosed(1, 20).boxed().toList());
    }

    @Test
    void parse_allOnlyAllowedWhenAllowAllTrue() {
        String content = "Attention <@all> and <@2>";

        MentionParser.ParseResult memberRes = MentionParser.parse(content, Set.of(1L, 2L), false);
        assertThat(memberRes.mentionsAll()).isFalse();
        assertThat(memberRes.userIds()).containsExactly(2L);

        MentionParser.ParseResult adminRes = MentionParser.parse(content, Set.of(1L, 2L), true);
        assertThat(adminRes.mentionsAll()).isTrue();
        assertThat(adminRes.userIds()).containsExactly(2L);
    }

    @Test
    void parse_ignoresTokensInsideCodeSpansAndFencedBlocks() {
        String content = "Real <@2>, inline `<@3> <@all>`, fenced ```\n<@4> <@all>\n```, trailing <@5>";
        MentionParser.ParseResult res = MentionParser.parse(content, Set.of(2L, 3L, 4L, 5L), true);

        assertThat(res.userIds()).containsExactly(2L, 5L);
        assertThat(res.mentionsAll()).isFalse();
    }

    @Test
    void renderDisplayText_replacesKnownMentionsAndKeepsUnknownOrCodeLiteral() {
        String content = "Hey <@2> and <@all>, ignore `<@2>` and <@999>";
        String rendered = MentionParser.renderDisplayText(content, Map.of(2L, "Ravi Patel"), true);

        assertThat(rendered).isEqualTo("Hey @Ravi Patel and @all, ignore `<@2>` and <@999>");
    }
}
