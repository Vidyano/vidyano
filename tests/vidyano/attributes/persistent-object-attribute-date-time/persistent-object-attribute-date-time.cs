#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

using System.ComponentModel.DataAnnotations;
using Vidyano.Core.Services;
using Vidyano.Service;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
    .WithDefaultAdmin()
    .WithDefaultUser("Admin")
    .WithSchemaRights()
    .WithMenuItem(nameof(MockContext.Attributes))
    .WithModel(builder =>
        {
            var po = builder.GetOrCreatePersistentObject(nameof(Mock_Attribute));

            var dateTimeReadOnly = po.GetOrCreateAttribute(nameof(Mock_Attribute.DateTimeReadOnly));
            dateTimeReadOnly.IsReadOnly = true;

            var dateTimeRequired = po.GetOrCreateAttribute(nameof(Mock_Attribute.DateTimeRequired));
            dateTimeRequired.AddRule("Required");

            var month = po.GetOrCreateAttribute(nameof(Mock_Attribute.Month));
            month.DataTypeHints = "displayformat={0:y}";

            var nullableMonth = po.GetOrCreateAttribute(nameof(Mock_Attribute.NullableMonth));
            nullableMonth.DataTypeHints = "displayformat={0:y}";

            var dateTimeMinMax = po.GetOrCreateAttribute(nameof(Mock_Attribute.DateTimeMinMax));
            dateTimeMinMax.DataTypeHints = "mindate=2024-01-01;maxdate=2024-12-31";
        })
    );

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    private static readonly List<Mock_Attribute> attributes = [];

    public MockContext()
    {
        Register(attributes);
    }

    public IQueryable<Mock_Attribute> Attributes => Query<Mock_Attribute>();

    public static Mock_Attribute GetOrCreateAttribute(string objectId)
    {
        var attribute = attributes.FirstOrDefault(a => a.Id == objectId);

        if (attribute == null)
            attributes.Add(attribute = new Mock_Attribute { Id = objectId });

        return attribute;
    }

    public override void AddObject(PersistentObject obj, object entity)
    {
        if (entity is Mock_Attribute attribute)
            attribute.Id ??= (attributes.Count + 1).ToString();

        base.AddObject(obj, entity);
    }
}

public class MockWeb: CustomApiController
{
    public override void GetWebsiteContent(WebsiteArgs args)
    {
        base.GetWebsiteContent(args);

        var frontEndUrl = ServiceLocator.GetService<IConfiguration>()["frontend:url"];
        if (!string.IsNullOrEmpty(frontEndUrl))
            args.Contents = args.Contents.Replace("https://unpkg.com/@vidyano/vidyano/index.min.js", frontEndUrl);
    }
}

public class Mock_AttributeActions(MockContext context) : PersistentObjectActions<MockContext, Mock_Attribute>(context)
{
    public override Mock_Attribute? GetEntity(PersistentObject obj)
    {
        if (string.IsNullOrEmpty(obj.ObjectId))
            throw new ArgumentException("ObjectId cannot be null or empty", nameof(obj));

        return MockContext.GetOrCreateAttribute(obj.ObjectId);
    }
}

public class Mock_Attribute
{
    public string Id { get; set; } = null!;

    public DateTime DateTime { get; set; } = DateTime.Now;

    public DateTime? NullableDateTime { get; set; } = null;

    public DateTime DateTimeReadOnly { get; set; } = DateTime.Now;

    public DateTime DateTimeRequired { get; set; } = DateTime.Now;

    [DataType(DataTypes.Date)]
    public DateTime Month { get; set; } = DateTime.Now;

    [DataType(DataTypes.NullableDate)]
    public DateTime? NullableMonth { get; set; } = null;

    public DateTime DateTimeMinMax { get; set; } = new DateTime(2024, 6, 15);

    public DateTime Date { get; set; } = DateTime.Today;

    public DateTime? NullableDate { get; set; } = null;
}
