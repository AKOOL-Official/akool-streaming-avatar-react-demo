import { logger } from './Logger';

export interface Resource {
  cleanup(): void | Promise<void>;
  readonly id?: string;
  readonly type?: string;
}

export interface ResourceGroup {
  readonly name: string;
  readonly resources: Resource[];
  cleanup(): Promise<void>;
}

export class ManagedResourceGroup implements ResourceGroup {
  public readonly name: string;
  public readonly resources: Resource[] = [];

  constructor(name: string) {
    this.name = name;
  }

  add(resource: Resource): void {
    this.resources.push(resource);
    logger.debug(`Added resource to group '${this.name}'`, {
      resourceId: resource.id,
      resourceType: resource.type,
      groupSize: this.resources.length,
    });
  }

  remove(resource: Resource): boolean {
    const index = this.resources.indexOf(resource);
    if (index > -1) {
      this.resources.splice(index, 1);
      logger.debug(`Removed resource from group '${this.name}'`, {
        resourceId: resource.id,
        resourceType: resource.type,
        groupSize: this.resources.length,
      });
      return true;
    }
    return false;
  }

  async cleanup(): Promise<void> {
    logger.info(`Cleaning up resource group '${this.name}'`, {
      resourceCount: this.resources.length,
    });

    const cleanupPromises = this.resources.map(async (resource, index) => {
      try {
        logger.debug(`Cleaning up resource ${index + 1}/${this.resources.length}`, {
          resourceId: resource.id,
          resourceType: resource.type,
          groupName: this.name,
        });

        await Promise.resolve(resource.cleanup());

        logger.debug(`Successfully cleaned up resource`, {
          resourceId: resource.id,
          resourceType: resource.type,
          groupName: this.name,
        });
      } catch (error) {
        logger.error(`Failed to cleanup resource`, {
          resourceId: resource.id,
          resourceType: resource.type,
          groupName: this.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(cleanupPromises);
    this.resources.length = 0; // Clear the array

    logger.info(`Completed cleanup for resource group '${this.name}'`);
  }
}

export class ResourceManager {
  private ownerResources = new WeakMap<object, Resource[]>();
  private namedGroups = new Map<string, ManagedResourceGroup>();
  private globalResources = new Set<Resource>();

  // Register a resource with a specific owner (typically a component or service instance)
  register(owner: object, resource: Resource): void {
    if (!this.ownerResources.has(owner)) {
      this.ownerResources.set(owner, []);
    }

    this.ownerResources.get(owner)!.push(resource);

    logger.debug('Registered resource with owner', {
      resourceId: resource.id,
      resourceType: resource.type,
      ownerType: owner.constructor.name,
    });
  }

  // Register a global resource (not tied to any specific owner)
  registerGlobal(resource: Resource): void {
    this.globalResources.add(resource);

    logger.debug('Registered global resource', {
      resourceId: resource.id,
      resourceType: resource.type,
    });
  }

  // Create or get a named resource group
  group(name: string): ManagedResourceGroup {
    if (!this.namedGroups.has(name)) {
      this.namedGroups.set(name, new ManagedResourceGroup(name));
      logger.debug(`Created resource group '${name}'`);
    }
    return this.namedGroups.get(name)!;
  }

  // Clean up all resources associated with a specific owner
  async cleanup(owner: object): Promise<void> {
    const resources = this.ownerResources.get(owner);
    if (!resources || resources.length === 0) {
      return;
    }

    logger.info('Cleaning up owner resources', {
      ownerType: owner.constructor.name,
      resourceCount: resources.length,
    });

    const cleanupPromises = resources.map(async (resource) => {
      try {
        await Promise.resolve(resource.cleanup());
        logger.debug('Successfully cleaned up owner resource', {
          resourceId: resource.id,
          resourceType: resource.type,
          ownerType: owner.constructor.name,
        });
      } catch (error) {
        logger.error('Failed to cleanup owner resource', {
          resourceId: resource.id,
          resourceType: resource.type,
          ownerType: owner.constructor.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(cleanupPromises);
    this.ownerResources.delete(owner);

    logger.info('Completed cleanup for owner', {
      ownerType: owner.constructor.name,
    });
  }

  // Clean up a specific named group
  async cleanupGroup(name: string): Promise<void> {
    const group = this.namedGroups.get(name);
    if (group) {
      await group.cleanup();
      this.namedGroups.delete(name);
    }
  }

  // Clean up all resources (global and named groups)
  async cleanupAll(): Promise<void> {
    logger.info('Starting global resource cleanup', {
      globalResources: this.globalResources.size,
      namedGroups: this.namedGroups.size,
    });

    // Cleanup named groups first
    const groupCleanupPromises = Array.from(this.namedGroups.values()).map((group) =>
      group.cleanup().catch((error) => {
        logger.error(`Failed to cleanup group '${group.name}'`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }),
    );

    await Promise.allSettled(groupCleanupPromises);
    this.namedGroups.clear();

    // Cleanup global resources
    const globalCleanupPromises = Array.from(this.globalResources).map(async (resource) => {
      try {
        await Promise.resolve(resource.cleanup());
        logger.debug('Successfully cleaned up global resource', {
          resourceId: resource.id,
          resourceType: resource.type,
        });
      } catch (error) {
        logger.error('Failed to cleanup global resource', {
          resourceId: resource.id,
          resourceType: resource.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(globalCleanupPromises);
    this.globalResources.clear();

    // Note: We don't clear ownerResources since it's a WeakMap and will be garbage collected
    logger.info('Completed global resource cleanup');
  }

  // Utility methods for monitoring and debugging
  getGlobalResourceCount(): number {
    return this.globalResources.size;
  }

  getNamedGroupCount(): number {
    return this.namedGroups.size;
  }

  getGroupNames(): string[] {
    return Array.from(this.namedGroups.keys());
  }

  getGroupResourceCount(name: string): number {
    return this.namedGroups.get(name)?.resources.length || 0;
  }

  hasGroup(name: string): boolean {
    return this.namedGroups.has(name);
  }
}

// Global resource manager instance
export const globalResourceManager = new ResourceManager();

// Utility function to create a simple resource from a cleanup function
export function createResource(cleanupFn: () => void | Promise<void>, id?: string, type?: string): Resource {
  return {
    cleanup: cleanupFn,
    id,
    type: type || 'generic',
  };
}

// Utility function to create a resource from an object with a cleanup method
export function resourceFromObject(obj: { cleanup(): void | Promise<void>; id?: string; type?: string }): Resource {
  return {
    cleanup: () => obj.cleanup(),
    id: obj.id,
    type: obj.type,
  };
}
