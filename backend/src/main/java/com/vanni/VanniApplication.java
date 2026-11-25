package com.vanni;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class VanniApplication {

	public static void main(String[] args) {
		SpringApplication.run(VanniApplication.class, args);
	}

}
