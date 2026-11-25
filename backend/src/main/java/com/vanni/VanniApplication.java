package com.vanni;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class VanniApplication {

	public static void main(String[] args) {
		SpringApplication.run(VanniApplication.class, args);
	}

	@Bean(name = "linkPreviewExecutor")
	public Executor linkPreviewExecutor() {
		ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
		executor.setCorePoolSize(2);
		executor.setMaxPoolSize(4);
		executor.setQueueCapacity(100);
		executor.setThreadNamePrefix("lp-");
		executor.initialize();
		return executor;
	}
}
