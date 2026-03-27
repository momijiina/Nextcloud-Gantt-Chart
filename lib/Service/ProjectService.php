<?php

declare(strict_types=1);

namespace OCA\Gantt\Service;

use DateTime;
use OCA\Gantt\Db\Project;
use OCA\Gantt\Db\ProjectMapper;
use OCA\Gantt\Db\TaskMapper;
use OCP\AppFramework\Db\DoesNotExistException;
use OCP\AppFramework\Db\MultipleObjectsReturnedException;

class ProjectService {

    public function __construct(
        private ProjectMapper $projectMapper,
        private TaskMapper $taskMapper,
    ) {
    }

    /**
     * @return Project[]
     */
    public function findAll(string $userId): array {
        return $this->projectMapper->findAllByUser($userId);
    }

    /**
     * @throws NotFoundException
     */
    public function find(int $id, string $userId): Project {
        try {
            return $this->projectMapper->findByIdAndUser($id, $userId);
        } catch (DoesNotExistException|MultipleObjectsReturnedException $e) {
            throw new NotFoundException($e->getMessage());
        }
    }

    public function create(string $title, ?string $description, ?string $color, string $userId): Project {
        $project = new Project();
        $project->setUserId($userId);
        $project->setTitle($title);
        $project->setDescription($description);
        $project->setColor($color ?? '#0082c9');
        $now = new DateTime();
        $project->setCreatedAt($now);
        $project->setUpdatedAt($now);
        return $this->projectMapper->insert($project);
    }

    /**
     * @throws NotFoundException
     */
    public function update(int $id, string $title, ?string $description, ?string $color, string $userId): Project {
        $project = $this->find($id, $userId);
        $project->setTitle($title);
        $project->setDescription($description);
        if ($color !== null) {
            $project->setColor($color);
        }
        $project->setUpdatedAt(new DateTime());
        return $this->projectMapper->update($project);
    }

    /**
     * @throws NotFoundException
     */
    public function delete(int $id, string $userId): Project {
        $project = $this->find($id, $userId);
        $this->taskMapper->deleteAllByProject($id, $userId);
        $this->projectMapper->delete($project);
        return $project;
    }
}
