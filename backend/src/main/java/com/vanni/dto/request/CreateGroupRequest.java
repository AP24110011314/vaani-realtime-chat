package com.vanni.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateGroupRequest(
    @NotBlank(message = "Title cannot be blank")
    @Size(min = 1, max = 100, message = "Title must be between 1 and 100 characters")
    String title,

    @Size(max = 500, message = "Description cannot exceed 500 characters")
    String description,

    @NotEmpty(message = "Member IDs cannot be empty")
    List<Long> memberIds
) {}
