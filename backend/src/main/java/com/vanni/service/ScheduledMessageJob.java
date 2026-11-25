package com.vanni.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ScheduledMessageJob {

    private final ScheduledMessageService scheduledMessageService;

    public ScheduledMessageJob(ScheduledMessageService scheduledMessageService) {
        this.scheduledMessageService = scheduledMessageService;
    }

    @Scheduled(fixedDelayString = "${app.schedule.poll-ms:10000}")
    public void run() {
        scheduledMessageService.processDueMessages();
    }
}
