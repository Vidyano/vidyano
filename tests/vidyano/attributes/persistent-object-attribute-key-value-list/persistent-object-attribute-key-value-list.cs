#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

using System.ComponentModel.DataAnnotations;
using Vidyano.Core.Services;
using Vidyano.Service;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
    .WithUrls("http://localhost:44355")
    .WithDefaultAdmin()
    .WithDefaultUser("Admin")
    .WithSchemaRights()
    .WithMenuItem(nameof(MockContext.Attributes))
    .WithModel(builder =>
        {
            var po = builder.GetOrCreatePersistentObject(nameof(Mock_Attribute));

            var keyValueList = po.GetOrCreateAttribute(nameof(Mock_Attribute.KeyValueList));
            keyValueList.DefaultOptions = "1=One\n2=Two\n3=Three\n4=Four\n5=Five";

            var keyValueListRadio = po.GetOrCreateAttribute(nameof(Mock_Attribute.KeyValueListRadio));
            keyValueListRadio.DefaultOptions = "1=One\n2=Two\n3=Three\n4=Four\n5=Five";
            keyValueListRadio.DataTypeHints = "inputtype=radio";

            var keyValueListChip = po.GetOrCreateAttribute(nameof(Mock_Attribute.KeyValueListChip));
            keyValueListChip.DefaultOptions = "1=One\n2=Two\n3=Three\n4=Four\n5=Five";
            keyValueListChip.DataTypeHints = "inputtype=chip";

            var keyValueListReadOnly = po.GetOrCreateAttribute(nameof(Mock_Attribute.KeyValueListReadOnly));
            keyValueListReadOnly.DefaultOptions = "1=One\n2=Two\n3=Three\n4=Four\n5=Five";
            keyValueListReadOnly.IsReadOnly = true;

            var keyValueListRequired = po.GetOrCreateAttribute(nameof(Mock_Attribute.KeyValueListRequired));
            keyValueListRequired.DefaultOptions = "1=One\n2=Two\n3=Three\n4=Four\n5=Five";
            keyValueListRequired.AddRule("Required");

            var keyValueListRadioHorizontal = po.GetOrCreateAttribute(nameof(Mock_Attribute.KeyValueListRadioHorizontal));
            keyValueListRadioHorizontal.DefaultOptions = "1=One\n2=Two\n3=Three\n4=Four\n5=Five";
            keyValueListRadioHorizontal.DataTypeHints = "inputtype=radio;orientation=horizontal";

            var keyValueListChipHorizontal = po.GetOrCreateAttribute(nameof(Mock_Attribute.KeyValueListChipHorizontal));
            keyValueListChipHorizontal.DefaultOptions = "1=One\n2=Two\n3=Three\n4=Four\n5=Five";
            keyValueListChipHorizontal.DataTypeHints = "inputtype=chip;orientation=horizontal";
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

    [DataType(DataTypes.KeyValueList)]
    public int? KeyValueList { get; set; } = 1;

    [DataType(DataTypes.KeyValueList)]
    public int? KeyValueListRadio { get; set; } = 2;

    [DataType(DataTypes.KeyValueList)]
    public int? KeyValueListChip { get; set; } = 3;

    [DataType(DataTypes.KeyValueList)]
    public int? KeyValueListReadOnly { get; set; } = 4;

    [DataType(DataTypes.KeyValueList)]
    public int? KeyValueListRequired { get; set; } = 1;

    [DataType(DataTypes.KeyValueList)]
    public int? KeyValueListRadioHorizontal { get; set; } = 5;

    [DataType(DataTypes.KeyValueList)]
    public int? KeyValueListChipHorizontal { get; set; } = 1;
}
