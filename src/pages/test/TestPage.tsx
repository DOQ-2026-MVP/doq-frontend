import NameList from "@/features/test/ui/NameList";

const TestPage = () => {
  return (
    <>
      <div>
        <div className="w-full h-screen flex items-center justify-center flex-col gap-16 bg-linear-to-b from-white to-blue-100">
          <h1 className="text-4xl font-bold">Hello, DOQ !</h1>

          <NameList />
        </div>
      </div>
    </>
  );
};

export default TestPage;
