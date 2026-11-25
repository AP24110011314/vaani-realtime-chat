package com.vanni.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EditMessageRequest(
    @NotBlank(message = "Content cannot be blank")
    @Size(max = 4000, message = "Content cannot exceed 4000 characters")
    String content
) {}
