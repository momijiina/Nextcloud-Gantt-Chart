<?php

declare(strict_types=1);

namespace OCA\Gantt\Db;

use OCP\AppFramework\Db\Entity;
use JsonSerializable;

/**
 * @method int getId()
 * @method void setId(int $id)
 * @method int getProjectId()
 * @method void setProjectId(int $projectId)
 * @method string getUserId()
 * @method void setUserId(string $userId)
 * @method string getTitle()
 * @method void setTitle(string $title)
 * @method string|null getDescription()
 * @method void setDescription(?string $description)
 * @method \DateTime getStartDate()
 * @method void setStartDate(\DateTime $startDate)
 * @method \DateTime getEndDate()
 * @method void setEndDate(\DateTime $endDate)
 * @method int getProgress()
 * @method void setProgress(int $progress)
 * @method string|null getColor()
 * @method void setColor(?string $color)
 * @method int getSortOrder()
 * @method void setSortOrder(int $sortOrder)
 * @method int|null getParentId()
 * @method void setParentId(?int $parentId)
 * @method int|null getDependencyId()
 * @method void setDependencyId(?int $dependencyId)
 * @method \DateTime getCreatedAt()
 * @method void setCreatedAt(\DateTime $createdAt)
 * @method \DateTime getUpdatedAt()
 * @method void setUpdatedAt(\DateTime $updatedAt)
 */
class Task extends Entity implements JsonSerializable {

    protected int $projectId = 0;
    protected string $userId = '';
    protected string $title = '';
    protected ?string $description = null;
    protected ?\DateTime $startDate = null;
    protected ?\DateTime $endDate = null;
    protected int $progress = 0;
    protected ?string $color = '#0082c9';
    protected int $sortOrder = 0;
    protected ?int $parentId = null;
    protected ?int $dependencyId = null;
    protected ?string $category = null;
    protected ?string $assignee = null;
    protected ?\DateTime $createdAt = null;
    protected ?\DateTime $updatedAt = null;

    public function __construct() {
        $this->addType('id', 'integer');
        $this->addType('projectId', 'integer');
        $this->addType('userId', 'string');
        $this->addType('title', 'string');
        $this->addType('description', 'string');
        $this->addType('startDate', 'datetime');
        $this->addType('endDate', 'datetime');
        $this->addType('progress', 'integer');
        $this->addType('color', 'string');
        $this->addType('sortOrder', 'integer');
        $this->addType('parentId', 'integer');
        $this->addType('dependencyId', 'integer');
        $this->addType('category', 'string');
        $this->addType('assignee', 'string');
        $this->addType('createdAt', 'datetime');
        $this->addType('updatedAt', 'datetime');
    }

    public function jsonSerialize(): array {
        return [
            'id' => $this->getId(),
            'projectId' => $this->getProjectId(),
            'userId' => $this->getUserId(),
            'title' => $this->getTitle(),
            'description' => $this->getDescription(),
            'startDate' => $this->getStartDate()?->format('Y-m-d'),
            'endDate' => $this->getEndDate()?->format('Y-m-d'),
            'progress' => $this->getProgress(),
            'color' => $this->getColor(),
            'sortOrder' => $this->getSortOrder(),
            'parentId' => $this->getParentId(),
            'dependencyId' => $this->getDependencyId(),
            'category' => $this->getCategory(),
            'assignee' => $this->getAssignee(),
            'createdAt' => $this->getCreatedAt()?->format('Y-m-d H:i:s'),
            'updatedAt' => $this->getUpdatedAt()?->format('Y-m-d H:i:s'),
        ];
    }
}
