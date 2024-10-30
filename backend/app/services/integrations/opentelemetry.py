from typing import Dict, List
from loguru import logger

from app.db.mongo import get_mongo_db
from opentelemetry.proto.trace.v1.trace_pb2 import TracesData
from google.protobuf.json_format import MessageToDict


class OpenTelemetryConnector:
    project_id: str
    org_id: str

    def __init__(self, org_id: str, project_id: str):
        self.project_id = project_id
        self.org_id = org_id

    async def _dump(self, data: TracesData) -> None:
        """
        Store the raw data in the database
        """
        mongo_db = await get_mongo_db()
        # Convert the data to a dictionary
        data_dict = MessageToDict(data)
        mongo_db["logs_opentelemetry"].insert_one(data_dict)

    async def process(self, data: TracesData) -> int:
        """
        Push the data and process it
        """
        # TODO : Add support for metadata

        logger.info(
            f"Processing OpenTelemetry data:\n{len(data.resource_spans[0].scope_spans[0].spans)} spans"
        )
        # Start by storing the raw data, for debug purposes
        await self._dump(data)

        # Exported spans to store in the database. They have additional metadata
        spans_to_export: List[dict] = []
        # Either each span has a task_id and session_id, or we use the one in the last span
        trace_task_id = None
        trace_session_id = None
        trace_metadata = None

        for resource in data.resource_spans:
            scope_spans = resource.scope_spans
            for scope in scope_spans:
                for span_id, span in enumerate(scope.spans):
                    span_task_id = None
                    span_session_id = None
                    span_metadata = None

                    # Unpack attributes
                    unpacked_attributes: dict = {}
                    for attr in span.attributes:
                        # Convert to a dictionary
                        k = attr.key
                        attr_dict = MessageToDict(attr)

                        if "stringValue" in attr_dict["value"]:
                            value = attr_dict["value"]["stringValue"]
                        elif "intValue" in attr_dict["value"]:
                            value = attr_dict["value"]["intValue"]
                        elif "boolValue" in attr_dict["value"]:
                            value = attr_dict["value"]["boolValue"]
                        elif "doubleValue" in attr_dict["value"]:
                            value = attr_dict["value"]["doubleValue"]
                        elif "arrayValue" in attr_dict["value"]:
                            value = attr_dict["value"]["arrayValue"]
                        else:
                            logger.error(f"Unknown value type: {attr_dict}")
                            continue

                        # Merge the nested attributes
                        keys = k.split(".")
                        current_dict = unpacked_attributes
                        for i, key in enumerate(keys[:-1]):
                            if key.isdigit():
                                # Skip if key is a digit: No need to unpack
                                continue

                            # Initialize the key if it does not exist
                            if key not in current_dict:
                                if keys[i + 1].isdigit():
                                    # If next key is a digit, then current key is a list
                                    current_dict[key] = []
                                else:
                                    # If next key is not a digit, then current key is a dictionary
                                    current_dict[key] = {}

                            # Move to the next level
                            if keys[i + 1].isdigit():
                                # If next key is a digit, then the current key is a list
                                if len(current_dict[key]) < int(keys[i + 1]) + 1:
                                    current_dict[key].append({})
                                try:
                                    current_dict = current_dict[key][int(keys[i + 1])]
                                except IndexError:
                                    logger.error(
                                        f"IndexError: {key} {keys[i + 1]} {current_dict[key]}"
                                    )
                                    continue
                            else:
                                current_dict = current_dict[key]
                        current_dict[keys[-1]] = value

                    # Convert the span to a dictionary and replace attributes with the unpacked ones
                    span_to_store = MessageToDict(span)
                    span_to_store["attributes"] = unpacked_attributes

                    logger.info(f"Span {span_id}: {span_to_store}")

                    if "phospho" in unpacked_attributes:
                        span_task_id = unpacked_attributes["phospho"].get("task_id")
                        span_session_id = unpacked_attributes["phospho"].get(
                            "session_id"
                        )
                        span_metadata = unpacked_attributes["phospho"].get("metadata")

                    if "gen_ai" in unpacked_attributes:
                        # Store the data in the database
                        if span_metadata and "phospho" in span_metadata:
                            span_metadata.pop("phospho")

                        spans_to_export.append(
                            {
                                "org_id": self.org_id,
                                "project_id": self.project_id,
                                "open_telemetry_data": span_to_store,
                                "task_id": span_task_id,
                                "session_id": span_session_id,
                                "metadata": span_metadata,
                            }
                        )
                        logger.info("Opentelemetry data stored in the database")

                    if span_id == len(scope.spans) - 1:
                        # Update the trace metadata
                        trace_task_id = span_task_id
                        trace_session_id = span_session_id
                        trace_metadata = span_metadata

        # Update the spans with missing task_id and session_id with the trace metadata
        if trace_task_id is not None and trace_session_id is not None:
            for span_export in spans_to_export:
                if span_export["task_id"] is None:
                    span_export["task_id"] = trace_task_id
                if span_export["session_id"] is None:
                    span_export["session_id"] = trace_session_id
                if span_export["metadata"] is None:
                    span_export["metadata"] = trace_metadata

        # Store the spans in the database
        if spans_to_export:
            mongo_db = await get_mongo_db()
            mongo_db["opentelemetry"].insert_many(spans_to_export)

        return 0


async def fetch_spans_for_task(
    project_id: str, task_id: str
) -> List[Dict[str, object]]:
    """
    Fetch all the spans linked to a task_id
    """

    mongo_db = await get_mongo_db()

    spans = (
        await mongo_db["opentelemetry"]
        .find({"project_id": project_id, "task_id": task_id})
        .to_list(None)
    )
    # Filter _id field
    for span in spans:
        span.pop("_id")

    return spans
