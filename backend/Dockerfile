FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q -B dependency:go-offline || true
COPY src src
RUN ./mvnw -q -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd -r -u 10001 vanni && mkdir -p /app/uploads && chown -R vanni:vanni /app
COPY --from=build /app/target/*.jar app.jar
ENV SERVER_PORT=8080 \
    STORAGE_LOCAL_DIR=/app/uploads
EXPOSE 8080
USER vanni
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
