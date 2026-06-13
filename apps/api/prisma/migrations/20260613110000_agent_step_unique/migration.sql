-- CreateIndex
CREATE UNIQUE INDEX "agent_steps_reviewRunId_agentName_key" ON "agent_steps"("reviewRunId", "agentName");
