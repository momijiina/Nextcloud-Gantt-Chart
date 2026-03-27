<?php

declare(strict_types=1);

return [
    'routes' => [
        // Page routes
        ['name' => 'page#index', 'url' => '/', 'verb' => 'GET'],

        // Project API routes
        ['name' => 'project_api#index', 'url' => '/api/projects', 'verb' => 'GET'],
        ['name' => 'project_api#show', 'url' => '/api/projects/{id}', 'verb' => 'GET'],
        ['name' => 'project_api#create', 'url' => '/api/projects', 'verb' => 'POST'],
        ['name' => 'project_api#update', 'url' => '/api/projects/{id}', 'verb' => 'PUT'],
        ['name' => 'project_api#destroy', 'url' => '/api/projects/{id}', 'verb' => 'DELETE'],

        // Task API routes
        ['name' => 'task_api#index', 'url' => '/api/projects/{projectId}/tasks', 'verb' => 'GET'],
        ['name' => 'task_api#show', 'url' => '/api/projects/{projectId}/tasks/{id}', 'verb' => 'GET'],
        ['name' => 'task_api#create', 'url' => '/api/projects/{projectId}/tasks', 'verb' => 'POST'],
        ['name' => 'task_api#update', 'url' => '/api/projects/{projectId}/tasks/{id}', 'verb' => 'PUT'],
        ['name' => 'task_api#destroy', 'url' => '/api/projects/{projectId}/tasks/{id}', 'verb' => 'DELETE'],
    ],
];
