package com.vanni.dto.request;

import jakarta.validation.constraints.NotNull;

public record AiConsentRequest(
    @NotNull(message = "enabled is required")
    Boolean enabled
) {}
