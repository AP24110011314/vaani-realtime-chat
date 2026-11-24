package com.vanni.dto.request;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record AddMembersRequest(
    @NotEmpty(message = "User IDs cannot be empty")
    List<Long> userIds
) {}
