import time

from fastapi import APIRouter, Header, Request
from fastapi_simple_rate_limiter import rate_limiter  # type: ignore
from loguru import logger
from phospho.models import Task

from phospho_backend.api.v2.models.triggers import TriggerClusteringRequest
from phospho_backend.core import config
from phospho_backend.db.mongo import get_mongo_db
from phospho_backend.services.integrations.postgresql import (
    PostgresqlCredentials,
    PostgresqlIntegration,
)
from phospho_backend.services.mongo.ai_hub import AIHubClient, ClusteringRequest
from phospho_backend.services.mongo.projects import get_project_by_id
from phospho_backend.services.mongo.triggers import aggregate_tasks_into_sessions

router = APIRouter(tags=["Trigger"])


@router.post(
    "/triggers/clustering",
    description="Run a clustering for a given project",
    response_model=dict,
)
@rate_limiter(limit=4, seconds=60)
async def trigger_clustering(
    clustering: TriggerClusteringRequest,
    _: Request,
    key: str | None = Header(default=None),
) -> dict:
    if key != config.API_TRIGGER_SECRET:
        return {"status": "error", "message": "Invalid secret key"}
    logger.info(f"Triggering clustering for project {clustering.project_id}")
    try:
        mongo_db = await get_mongo_db()
        project = await mongo_db["projects"].find_one(
            {"id": clustering.project_id}, {"org_id": 1}
        )
        org_id = project["org_id"]

        ai_hub_client = AIHubClient(org_id=org_id, project_id=clustering.project_id)
        await ai_hub_client.run_clustering(
            clustering_request=ClusteringRequest(
                project_id=clustering.project_id,
                org_id=org_id,
                limit=clustering.limit,
                nb_credits_used=0,
                user_email=None,  # This will NOT send an email
                scope=clustering.scope,
                output_format=clustering.output_format,
            ),
        )
        return {"status": "ok", "message": "Clustering triggered successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post(
    "/triggers/calculate-sessions/{project_id}",
    description="Recalculate sessions for a given project",
    response_model=dict,
)
@rate_limiter(limit=200, seconds=60)
async def trigger_calculate_sessions(
    project_id: str,
    _: Request,
    key: str | None = Header(default=None),
) -> dict:
    if key != config.API_TRIGGER_SECRET:
        return {"status": "error", "message": "Invalid secret key"}
    logger.info(f"Triggering session calculation for project {project_id}")
    try:
        mongo_db = await get_mongo_db()

        if project_id == "all_projects":
            projects = await mongo_db["projects"].find({}, {"id": 1}).to_list(None)
            for project in projects:
                await trigger_calculate_sessions(project["id"], _, key)
                time.sleep(0.1)
            return {"status": "ok", "message": "Sessions calculated for all projects"}

        tasks = await mongo_db["tasks"].find({"project_id": project_id}).to_list(None)
        for task in tasks:
            del task["_id"]
        validated_tasks = [Task.model_validate(task) for task in tasks]

        sessions = aggregate_tasks_into_sessions(validated_tasks, project_id=project_id)

        if sessions:
            logger.debug(f"Deleting all sessions for project {project_id}")
            await mongo_db["sessions"].delete_many({"project_id": project_id})
            logger.debug(f"Sessions deleted for project {project_id}")

            await mongo_db["sessions"].insert_many(
                [session.model_dump() for session in sessions]
            )
            logger.info(
                f"Inserted {len(sessions)} new sessions for project {project_id}"
            )

        return {
            "status": "ok",
            "message": "Sessions calculated successfully",
            "nbr sessions created": len(sessions),
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post(
    "/triggers/sync-postgresql/{project_id}",
    description="Run the synchronisation pipeline for PostgreSQL",
    response_model=dict,
)
@rate_limiter(limit=10, seconds=60)
async def trigger_postgresql_pipeline(
    project_id: str,
    _: Request,
    key: str | None = Header(default=None),
) -> dict:
    if key != config.API_TRIGGER_SECRET:
        return {"status": "error", "message": "Invalid secret key"}
    logger.info(f"Triggering PostgreSQL sync pipeline for project {project_id}")

    mongo_db = await get_mongo_db()
    integration = (
        await mongo_db["integrations"]
        .aggregate(
            [
                {
                    "$match": {
                        "type": "postgresql",
                        "$or": [
                            {"projects_started": project_id},
                            {"projects_finished": project_id},
                        ],
                    }
                }
            ]
        )
        .to_list(1)
    )
    if not integration or len(integration) == 0:
        return {"status": "error", "message": "No PostgreSQL integration found"}

    try:
        valid_integration = PostgresqlCredentials.model_validate(integration[0])
        project = await get_project_by_id(project_id)
        postgresql_integration = PostgresqlIntegration(
            org_id=valid_integration.org_id,
            org_name=valid_integration.org_name,
            project_id=project.id,
            project_name=project.project_name,
        )
        await postgresql_integration.push()
    except Exception as e:
        logger.error(
            f"Error running postgresql sync pipeline project {project_id}: {e}"
        )
        return {"status": "error", "message": str(e)}

    return {
        "status": "ok",
    }
