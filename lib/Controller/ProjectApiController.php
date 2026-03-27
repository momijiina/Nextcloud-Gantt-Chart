<?php

declare(strict_types=1);

namespace OCA\Gantt\Controller;

use OCA\Gantt\AppInfo\Application;
use OCA\Gantt\Service\NotFoundException;
use OCA\Gantt\Service\ProjectService;
use OCP\AppFramework\ApiController;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\FrontpageRoute;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\IRequest;

class ProjectApiController extends ApiController {

    private ?string $userId;

    public function __construct(
        IRequest $request,
        private ProjectService $projectService,
        ?string $userId,
    ) {
        parent::__construct(Application::APP_ID, $request);
        $this->userId = $userId;
    }

    #[NoAdminRequired]
    #[FrontpageRoute(verb: 'GET', url: '/api/projects')]
    public function index(): DataResponse {
        return new DataResponse($this->projectService->findAll($this->userId));
    }

    #[NoAdminRequired]
    #[FrontpageRoute(verb: 'GET', url: '/api/projects/{id}')]
    public function show(int $id): DataResponse {
        try {
            return new DataResponse($this->projectService->find($id, $this->userId));
        } catch (NotFoundException $e) {
            return new DataResponse(['message' => $e->getMessage()], Http::STATUS_NOT_FOUND);
        }
    }

    #[NoAdminRequired]
    #[FrontpageRoute(verb: 'POST', url: '/api/projects')]
    public function create(string $title, ?string $description = null, ?string $color = null): DataResponse {
        return new DataResponse(
            $this->projectService->create($title, $description, $color, $this->userId),
            Http::STATUS_CREATED
        );
    }

    #[NoAdminRequired]
    #[FrontpageRoute(verb: 'PUT', url: '/api/projects/{id}')]
    public function update(int $id, string $title, ?string $description = null, ?string $color = null): DataResponse {
        try {
            return new DataResponse($this->projectService->update($id, $title, $description, $color, $this->userId));
        } catch (NotFoundException $e) {
            return new DataResponse(['message' => $e->getMessage()], Http::STATUS_NOT_FOUND);
        }
    }

    #[NoAdminRequired]
    #[FrontpageRoute(verb: 'DELETE', url: '/api/projects/{id}')]
    public function destroy(int $id): DataResponse {
        try {
            return new DataResponse($this->projectService->delete($id, $this->userId));
        } catch (NotFoundException $e) {
            return new DataResponse(['message' => $e->getMessage()], Http::STATUS_NOT_FOUND);
        }
    }
}
