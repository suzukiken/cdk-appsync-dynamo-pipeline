import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import * as dynamodb from '@aws-cdk/aws-dynamodb';

export class CdkappsyncDynamoPipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const PREFIX_NAME = id.toLowerCase().replace("stack", "")
    const TABLE_GSI_NAME = 'titleIndex'

    // AppSync GraphQL API

    const api = new appsync.GraphqlApi(this, "api", {
      name: PREFIX_NAME + "-api",
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
        },
      },
      schema: new appsync.Schema({
        filePath: "graphql/schema.graphql",
      }),
    })
    
    // Dynamo Table
    
    const product_table = new dynamodb.Table(this, "product_table", {
      tableName: PREFIX_NAME + "Product",
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    })
    
    product_table.addGlobalSecondaryIndex({
      indexName: TABLE_GSI_NAME,
      partitionKey: {
        name: "title",
        type: dynamodb.AttributeType.STRING,
      },
    })
    
    // AppSync Datasource
    
    const product_datasource = api.addDynamoDbDataSource(
      "product_datasource",
      product_table
    )
    
    // AppSync Resolver

    product_datasource.createResolver({
      typeName: "Query",
      fieldName: "listProducts",
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbScanTable(),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
    })

    product_datasource.createResolver({
      typeName: "Mutation",
      fieldName: "addProduct",
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbPutItem(
        appsync.PrimaryKey.partition("id").auto(),
        appsync.Values.projecting("input")
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    })
    
    // AppSync Function
    
    const listbytitle_function = new appsync.AppsyncFunction(this, 'listbytitle_function', {
      api: api,
      dataSource: product_datasource,
      name: "listbytitle",
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbQuery(
        appsync.KeyCondition.eq("title", "title"),
        TABLE_GSI_NAME
      ),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
    })
    
    const deletebyids_function = new appsync.AppsyncFunction(this, 'deletebyids_function', {
      api: api,
      dataSource: product_datasource,
      name: "deletebyids",
      requestMappingTemplate: appsync.MappingTemplate.fromFile(
        "mapping_template/deletebyids_request.vtl"
      ),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        `$util.toJson($ctx.result)`
      ),
    })
    
    // AppSync Pipeline Resolver
    
    const appsync_resolver = new appsync.Resolver(this, 'appsync_resolver', {
      api: api,
      fieldName: "deleteProductsByTitle",
      typeName: "Mutation",
      pipelineConfig: [
        listbytitle_function,
        deletebyids_function
      ],
      requestMappingTemplate: appsync.MappingTemplate.fromString(`
        #set($result = { "title": $ctx.args.title })
        $util.toJson($result)
      `),
      responseMappingTemplate: appsync.MappingTemplate.fromString(
        `$util.toJson($ctx.result.data.cdkappsyncdynamopipelineProduct)`
      ),
    })
    
    // Output
    // Set these params to enviroment varibles at test/set_enviroment_variable.sh
    
    if (api.apiKey) {
      new cdk.CfnOutput(this, "apikey_output", { value: api.apiKey })
    }
    
    new cdk.CfnOutput(this, "graphql_url_output", { value: api.graphqlUrl })
  }
}
