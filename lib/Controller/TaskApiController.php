<?php

declare(strict_types=1);

namespace OCA\Gantt\Controller;

use OCA\Gantt\AppInfo\Application;
use OCA\Gantt\Service\NotFoundException;
use OCA\Gantt\Service\TaskService;
use OCP\AppFramework\ApiController;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\IRequest;

class TaskApiController extends ApiController {

    private ?string $userId;

    public function __construct(
        IRequest $request,
        private TaskService $taskService,
        ?string $userId,
    ) {
        parent::__construct(Application::APP_ID, $request);
        $this->userId = $userId;
    }

    #[NoAdminRequired]
    #[FrontpageRoute(verb: 'GET', url: '/api/projects/{projectId}/tasks')]
    public function index(int $projectId): DataResponse {
        return new DataResponse($this->taskService->findAll($projectId, $this->userId));
    }

    #[NoAdminRequired]
    #[FrontpageRoute(verb: 'GET', url: '/api/projects/{projectId}/tasks/{id}')]
    public function show(int $projectId, int $id): DataResponse {
        try {
            return new DataResponse($this->taskService->find($id, $this->userId));
        } catch (NotFoundException $e) {
            return new DataResponse(['message' => $e->getMessage()], Http::STATUS_NOT_FOUND);
        }
    }

    #[NoAdminRequired]
    #[FrontpageRoute(verb: 'POST', url: '/api/projects/{projectId}/tasks')]
    public function create(
        int $projectId,
        string $title,
        string $startDate,
        string $endDate,
        ?string $description = null,
        int $progress = 0,
        ?string $color = null,
        int $sortOrder = 0,
        ?int $parentId = null,
        ?int $dependencyId = null,
        ?string $category = null,
        ?string $assignee = null,
    ): DataResponse {
        return new DataResponse(
            $this->taskService->create(
                $projectId, $title, $description, $startDate, $endDate,
                $progress, $color, $sortOrder, $parentId, $dependencyId,
                $category, $assignee, $this->userId
            ),
            Http::STATUS_CREATED
        );
    }

    #[NoAdminRequired]
    #[FrontpageRoute(verb: 'PUT', url: '/api/projects/{projectId}/tasks/{id}')]
    public function update(
        int $projectId,
        int $id,
        string $title,
        string $startDate,
        string $endDate,
        ?string $description = null,
        int $progress = 0,
        ?string $color = null,
        int $sortOrder = 0,
        ?int $parentId = null,
        ?int $dependencyId = null,
        ?string $category = null,
        ?string $assignee = null,
    ): DataResponse {
        try {
            return new DataResponse(
                $this->taskService->update(
                    $id, $title, $description, $startDate, $endDate,
                    $progress, $color, $sortOrder, $parentId, $dependencyId,
                    $category, $assignee, $this->userId
                )
            );
        } catch (NotFoundException $e) {
            return new DataResponse(['message' => $e->getMessage()], Http::STATUS_NOT_FOUND);
        }
    }

    #[NoAdminRequired]
    #[FrontpageRoute(verb: 'DELETE', url: '/api/projects/{projectId}/tasks/{id}')]
    public function destroy(int $projectId, int $id): DataResponse {
        try {
            return new DataResponse($this->taskService->delete($id, $this->userId));
        } catch (NotFoundException $e) {
            return new DataResponse(['message' => $e->getMessage()], Http::STATUS_NOT_FOUND);
        }
    }
}
