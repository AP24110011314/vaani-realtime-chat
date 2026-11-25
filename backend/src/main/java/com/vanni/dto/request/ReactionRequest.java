package com.vanni.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReactionRequest(
    @NotBlank(message = "Emoji cannot be blank")
    @Size(max = 32, message = "Emoji length cannot exceed 32 characters")
    String emoji
) {}
