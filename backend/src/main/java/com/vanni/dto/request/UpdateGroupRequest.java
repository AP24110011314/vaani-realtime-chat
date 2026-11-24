package com.vanni.dto.request;

import jakarta.validation.constraints.Size;

public record UpdateGroupRequest(
    @Size(min = 1, max = 100, message = "Title must be between 1 and 100 characters")
    String title,

    @Size(max = 500, message = "Description cannot exceed 500 characters")
    String description
) {}
