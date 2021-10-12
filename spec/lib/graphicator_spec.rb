describe Lodqa::Graphicator do
  describe "#initialize" do
    context "when a URL is given" do 
      before do
        @enjuURL = "http://bionlp.dbcls.jp/enju"
      end

      it "should produce a enju accessor" do
        g = Lodqa::Graphicator.new(@enjuURL)
        expect(g.parser.enju.url).to eq(@enjuURL)
      end
    end

    context "when a URL is not given" do
      it "should raise an ArgumentError" do
        expect{Lodqa::Graphicator.new}.to raise_error(ArgumentError)
      end
    end

    context "when an empty URL is not given" do
      it "should raise an ArgumentError" do
        expect{Lodqa::Graphicator.new("")}.to raise_error(ArgumentError)
      end
    end
  end

  describe "#parse" do
    before do
      @enjuURL = "http://bionlp.dbcls.jp/enju"
      @g = Lodqa::Graphicator.new(@enjuURL)
      @query = "what genes are associated with alzheimer disease?"
    end

    context "when a sentence is given" do
      it "should produce its parse" do
        parse = @g.parse(@query)
        expect(parse.pgp).to include(:edges => [{:object=>"t2", :subject=>"t1", :text=>"associated with"}])
        expect(parse.pgp).to include(:focus => "t1")
        expect(parse.pgp).to include(:nodes => {:t1=>{:head=>1, :text=>"genes"}, :t2=>{:head=>6, :text=>"alzheimer disease"}})
      end
    end
  end
end
