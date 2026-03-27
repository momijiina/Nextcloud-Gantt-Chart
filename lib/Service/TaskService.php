<?php

declare(strict_types=1);

namespace OCA\Gantt\Service;

use DateTime;
use OCA\Gantt\Db\Task;
use OCA\Gantt\Db\TaskMapper;
use OCP\AppFramework\Db\DoesNotExistException;
use OCP\AppFramework\Db\MultipleObjectsReturnedException;

class TaskService {

    public function __construct(
        private TaskMapper $taskMapper,
    ) {
    }

    /**
     * @return Task[]
     */
    public function findAll(int $projectId, string $userId): array {
        return $this->taskMapper->findAllByProject($projectId, $userId);
    }

    /**
     * @throws NotFoundException
     */
    public function find(int $id, string $userId): Task {
        try {
            return $this->taskMapper->findByIdAndUser($id, $userId);
        } catch (DoesNotExistException|MultipleObjectsReturnedException $e) {
            throw new NotFoundException($e->getMessage());
        }
    }

    public function create(
        int $projectId,
        string $title,
        ?string $description,
        string $startDate,
        string $endDate,
        int $progress,
        ?string $color,
        int $sortOrder,
        ?int $parentId,
        ?int $dependencyId,
        ?string $category,
        ?string $assignee,
        string $userId
    ): Task {
        $task = new Task();
        $task->setProjectId($projectId);
        $task->setUserId($userId);
        $task->setTitle($title);
        $task->setDescription($description);
        $task->setStartDate(new DateTime($startDate));
        $task->setEndDate(new DateTime($endDate));
        $task->setProgress(max(0, min(100, $progress)));
        $task->setColor($color ?? '#0082c9');
        $task->setSortOrder($sortOrder);
        $task->setParentId($parentId);
        $task->setDependencyId($dependencyId);
        $task->setCategory($category);
        $task->setAssignee($assignee);
        $now = new DateTime();
        $task->setCreatedAt($now);
        $task->setUpdatedAt($now);
        return $this->taskMapper->insert($task);
    }

    /**
     * @throws NotFoundException
     */
    public function update(
        int $id,
        string $title,
        ?string $description,
        string $startDate,
        string $endDate,
        int $progress,
        ?string $color,
        int $sortOrder,
        ?int $parentId,
        ?int $dependencyId,
        ?string $category,
        ?string $assignee,
        string $userId
    ): Task {
        $task = $this->find($id, $userId);
        $task->setTitle($title);
        $task->setDescription($description);
        $task->setStartDate(new DateTime($startDate));
        $task->setEndDate(new DateTime($endDate));
        $task->setProgress(max(0, min(100, $progress)));
        if ($color !== null) {
            $task->setColor($color);
        }
        $task->setSortOrder($sortOrder);
        $task->setParentId($parentId);
        $task->setDependencyId($dependencyId);
        $task->setCategory($category);
        $task->setAssignee($assignee);
        $task->setUpdatedAt(new DateTime());
        return $this->taskMapper->update($task);
    }

    /**
     * @throws NotFoundException
     */
    public function delete(int $id, string $userId): Task {
        $task = $this->find($id, $userId);
        $this->taskMapper->delete($task);
        return $task;
    }
}
