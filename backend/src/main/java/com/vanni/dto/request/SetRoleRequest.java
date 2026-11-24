package com.vanni.dto.request;

import com.vanni.entity.MemberRole;
import jakarta.validation.constraints.NotNull;

public record SetRoleRequest(
    @NotNull(message = "Role is required")
    MemberRole role
) {}
