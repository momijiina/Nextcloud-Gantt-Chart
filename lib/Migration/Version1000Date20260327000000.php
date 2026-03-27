<?php

declare(strict_types=1);

namespace OCA\Gantt\Migration;

use Closure;
use OCP\DB\ISchemaWrapper;
use OCP\DB\Types;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

class Version1000Date20260327000000 extends SimpleMigrationStep {

    public function changeSchema(IOutput $output, Closure $schemaClosure, array $options): ?ISchemaWrapper {
        /** @var ISchemaWrapper $schema */
        $schema = $schemaClosure();

        // Projects table
        if (!$schema->hasTable('gantt_projects')) {
            $table = $schema->createTable('gantt_projects');
            $table->addColumn('id', Types::BIGINT, [
                'autoincrement' => true,
                'notnull' => true,
                'length' => 8,
            ]);
            $table->addColumn('user_id', Types::STRING, [
                'notnull' => true,
                'length' => 64,
            ]);
            $table->addColumn('title', Types::STRING, [
                'notnull' => true,
                'length' => 255,
            ]);
            $table->addColumn('description', Types::TEXT, [
                'notnull' => false,
            ]);
            $table->addColumn('color', Types::STRING, [
                'notnull' => false,
                'length' => 7,
                'default' => '#0082c9',
            ]);
            $table->addColumn('created_at', Types::DATETIME, [
                'notnull' => true,
            ]);
            $table->addColumn('updated_at', Types::DATETIME, [
                'notnull' => true,
            ]);
            $table->setPrimaryKey(['id']);
            $table->addIndex(['user_id'], 'gantt_projects_user_id');
        }

        // Tasks table
        if (!$schema->hasTable('gantt_tasks')) {
            $table = $schema->createTable('gantt_tasks');
            $table->addColumn('id', Types::BIGINT, [
                'autoincrement' => true,
                'notnull' => true,
                'length' => 8,
            ]);
            $table->addColumn('project_id', Types::BIGINT, [
                'notnull' => true,
                'length' => 8,
            ]);
            $table->addColumn('user_id', Types::STRING, [
                'notnull' => true,
                'length' => 64,
            ]);
            $table->addColumn('title', Types::STRING, [
                'notnull' => true,
                'length' => 255,
            ]);
            $table->addColumn('description', Types::TEXT, [
                'notnull' => false,
            ]);
            $table->addColumn('start_date', Types::DATE, [
                'notnull' => true,
            ]);
            $table->addColumn('end_date', Types::DATE, [
                'notnull' => true,
            ]);
            $table->addColumn('progress', Types::INTEGER, [
                'notnull' => true,
                'default' => 0,
            ]);
            $table->addColumn('color', Types::STRING, [
                'notnull' => false,
                'length' => 7,
                'default' => '#0082c9',
            ]);
            $table->addColumn('sort_order', Types::INTEGER, [
                'notnull' => true,
                'default' => 0,
            ]);
            $table->addColumn('parent_id', Types::BIGINT, [
                'notnull' => false,
                'length' => 8,
            ]);
            $table->addColumn('dependency_id', Types::BIGINT, [
                'notnull' => false,
                'length' => 8,
            ]);
            $table->addColumn('category', Types::STRING, [
                'notnull' => false,
                'length' => 64,
                'default' => null,
            ]);
            $table->addColumn('assignee', Types::STRING, [
                'notnull' => false,
                'length' => 128,
                'default' => null,
            ]);
            $table->addColumn('created_at', Types::DATETIME, [
                'notnull' => true,
            ]);
            $table->addColumn('updated_at', Types::DATETIME, [
                'notnull' => true,
            ]);
            $table->setPrimaryKey(['id']);
            $table->addIndex(['project_id'], 'gantt_tasks_project_id');
            $table->addIndex(['user_id'], 'gantt_tasks_user_id');
            $table->addIndex(['parent_id'], 'gantt_tasks_parent_id');
        }

        return $schema;
    }
}
